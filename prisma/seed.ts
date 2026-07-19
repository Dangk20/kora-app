// Seed de desarrollo — KORA
// Datos DEMO: se reemplazan con el catálogo real del cliente (Excel, Semana 3).
// Regla respetada incluso aquí: el stock entra por el libro contable (COMPRA_INICIAL),
// nunca escribiendo stockActual por fuera de la transacción del movimiento.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── Matriz de permisos módulo × acción ──────────────────────
const MATRIX: Record<string, string[]> = {
  catalog: ["view", "create", "edit", "delete"],
  inventory: ["view", "adjust"],
  orders: ["view", "create", "edit", "confirm", "cancel"],
  pos: ["view", "sell"],
  crm: ["view", "create", "edit", "export"],
  dashboard: ["view"],
  loyalty: ["view", "adjust"],
  marketing: ["view", "create", "send"],
  users: ["view", "create", "edit", "delete"],
  settings: ["view", "edit"],
};

const ROLES: Record<string, { description: string; grants: string[] | "ALL" }> = {
  admin: { description: "Acceso total", grants: "ALL" },
  operador: {
    description: "Opera pedidos, inventario y clientes",
    grants: [
      "catalog:view", "catalog:edit",
      "inventory:view", "inventory:adjust",
      "orders:view", "orders:create", "orders:edit", "orders:confirm", "orders:cancel",
      "crm:view", "crm:create", "crm:edit",
      "dashboard:view", "loyalty:view",
    ],
  },
  cajero: {
    description: "Punto de venta",
    grants: ["pos:view", "pos:sell", "catalog:view", "orders:view"],
  },
  marketing: {
    description: "Campañas y clientes",
    grants: ["crm:view", "crm:export", "marketing:view", "marketing:create", "marketing:send", "dashboard:view"],
  },
};

// ── Catálogo demo: 20 productos, 4 categorías ───────────────
type DemoProduct = {
  name: string;
  category: string;
  brand?: string;
  variants: { name: string; attrs?: Record<string, string>; cop: number; usd: number; stock: number }[];
};

// Paleta de tiles del prototipo aprobado (pastel bg + ícono lucide)
const CATEGORIES: { name: string; color: string; icon: string }[] = [
  { name: "Tecnología", color: "#FBE3D3", icon: "smartphone" },
  { name: "Hogar", color: "#FBEFD6", icon: "lamp" },
  { name: "Belleza", color: "#ECE0F5", icon: "sparkles" },
  { name: "Accesorios", color: "#F8D7DD", icon: "watch" },
];

const PRODUCTS: DemoProduct[] = [
  { name: "[DEMO] Audífonos inalámbricos Ultra", category: "Tecnología", brand: "SoundMax", variants: [
    { name: "Negro", attrs: { color: "Negro" }, cop: 189900, usd: 49, stock: 25 },
    { name: "Blanco", attrs: { color: "Blanco" }, cop: 189900, usd: 49, stock: 18 },
  ]},
  { name: "[DEMO] Smartwatch Active 5", category: "Tecnología", brand: "Redmi", variants: [
    { name: "Negro", attrs: { color: "Negro" }, cop: 259900, usd: 65, stock: 12 },
    { name: "Rosa", attrs: { color: "Rosa" }, cop: 259900, usd: 65, stock: 9 },
  ]},
  { name: "[DEMO] Parlante Bluetooth 360", category: "Tecnología", variants: [{ name: "Única", cop: 149900, usd: 39, stock: 30 }] },
  { name: "[DEMO] Cargador rápido 65W", category: "Tecnología", variants: [{ name: "Única", cop: 89900, usd: 24, stock: 50 }] },
  { name: "[DEMO] Teclado mecánico compacto", category: "Tecnología", variants: [{ name: "Única", cop: 219900, usd: 55, stock: 15 }] },
  { name: "[DEMO] Lámpara de escritorio LED", category: "Hogar", variants: [{ name: "Única", cop: 79900, usd: 21, stock: 40 }] },
  { name: "[DEMO] Difusor aromático", category: "Hogar", variants: [{ name: "Única", cop: 64900, usd: 17, stock: 35 }] },
  { name: "[DEMO] Juego de sábanas premium", category: "Hogar", variants: [
    { name: "Sencillo", attrs: { tamaño: "Sencillo" }, cop: 129900, usd: 34, stock: 20 },
    { name: "Doble", attrs: { tamaño: "Doble" }, cop: 169900, usd: 44, stock: 14 },
    { name: "Queen", attrs: { tamaño: "Queen" }, cop: 199900, usd: 52, stock: 10 },
  ]},
  { name: "[DEMO] Organizador de cocina", category: "Hogar", variants: [{ name: "Única", cop: 54900, usd: 14, stock: 45 }] },
  { name: "[DEMO] Cafetera de prensa francesa", category: "Hogar", variants: [{ name: "Única", cop: 94900, usd: 25, stock: 22 }] },
  { name: "[DEMO] Sérum facial vitamina C", category: "Belleza", variants: [{ name: "Única", cop: 74900, usd: 19, stock: 60 }] },
  { name: "[DEMO] Kit de brochas x12", category: "Belleza", variants: [{ name: "Única", cop: 59900, usd: 16, stock: 38 }] },
  { name: "[DEMO] Crema hidratante 24h", category: "Belleza", variants: [{ name: "Única", cop: 49900, usd: 13, stock: 55 }] },
  { name: "[DEMO] Perfume esencia floral", category: "Belleza", variants: [
    { name: "50 ml", attrs: { tamaño: "50 ml" }, cop: 119900, usd: 31, stock: 16 },
    { name: "100 ml", attrs: { tamaño: "100 ml" }, cop: 179900, usd: 47, stock: 11 },
  ]},
  { name: "[DEMO] Mascarilla capilar reparadora", category: "Belleza", variants: [{ name: "Única", cop: 44900, usd: 12, stock: 42 }] },
  { name: "[DEMO] Bolso tote de cuero", category: "Accesorios", variants: [
    { name: "Café", attrs: { color: "Café" }, cop: 249900, usd: 64, stock: 8 },
    { name: "Negro", attrs: { color: "Negro" }, cop: 249900, usd: 64, stock: 12 },
  ]},
  { name: "[DEMO] Gafas de sol polarizadas", category: "Accesorios", variants: [{ name: "Única", cop: 99900, usd: 26, stock: 28 }] },
  { name: "[DEMO] Billetera minimalista", category: "Accesorios", variants: [{ name: "Única", cop: 69900, usd: 18, stock: 33 }] },
  { name: "[DEMO] Gorra clásica bordada", category: "Accesorios", variants: [
    { name: "Negra", attrs: { color: "Negra" }, cop: 49900, usd: 13, stock: 26 },
    { name: "Beige", attrs: { color: "Beige" }, cop: 49900, usd: 13, stock: 21 },
  ]},
  { name: "[DEMO] Correa de reloj intercambiable", category: "Accesorios", variants: [{ name: "Única", cop: 39900, usd: 10, stock: 48 }] },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\[demo\]\s*/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Precio online: 5% menos que tienda, redondeado a la centena.
const online = (store: number) => Math.round((store * 0.95) / 100) * 100;

async function main() {
  // Permisos
  const permIds = new Map<string, string>();
  for (const [module, actions] of Object.entries(MATRIX)) {
    for (const action of actions) {
      const p = await db.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
      permIds.set(`${module}:${action}`, p.id);
    }
  }

  // Roles + asignaciones
  for (const [name, def] of Object.entries(ROLES)) {
    const role = await db.role.upsert({
      where: { name },
      update: { description: def.description },
      create: { name, description: def.description },
    });
    const grants = def.grants === "ALL" ? [...permIds.keys()] : def.grants;
    for (const key of grants) {
      const permissionId = permIds.get(key);
      if (!permissionId) throw new Error(`Permiso inexistente en la matriz: ${key}`);
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // Usuario admin de desarrollo
  const adminRole = await db.role.findUniqueOrThrow({ where: { name: "admin" } });
  const admin = await db.user.upsert({
    where: { email: "admin@kora.local" },
    update: {},
    create: {
      email: "admin@kora.local",
      name: "Admin KORA",
      passwordHash: await bcrypt.hash("kora-dev-2026", 10),
      roleId: adminRole.id,
    },
  });

  // Categorías
  const catIds = new Map<string, string>();
  for (const [i, cat] of CATEGORIES.entries()) {
    const c = await db.category.upsert({
      where: { slug: slugify(cat.name) },
      update: { color: cat.color, icon: cat.icon },
      create: {
        name: cat.name,
        slug: slugify(cat.name),
        position: i,
        color: cat.color,
        icon: cat.icon,
      },
    });
    catIds.set(cat.name, c.id);
  }

  // Productos + variantes + stock inicial vía libro contable
  let skuSeq = 1;
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    const existing = await db.product.findUnique({ where: { slug } });
    if (existing) { skuSeq += p.variants.length; continue; }

    const product = await db.product.create({
      data: {
        name: p.name,
        slug,
        brand: p.brand,
        categoryId: catIds.get(p.category)!,
        description: "Producto de demostración. Se reemplaza con el catálogo real.",
      },
    });

    for (const v of p.variants) {
      const sku = `DEMO-${String(skuSeq++).padStart(4, "0")}`;
      // Transacción única: crear variante + movimiento inicial + materializar stock
      await db.$transaction(async (tx) => {
        const variant = await tx.variant.create({
          data: {
            productId: product.id,
            sku,
            name: v.name,
            attributes: v.attrs,
            priceCopStore: v.cop,
            priceCopOnline: online(v.cop),
            priceUsdStore: v.usd,
            priceUsdOnline: Math.max(1, Math.round(v.usd * 0.95)),
            stockMin: 3,
          },
        });
        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            delta: v.stock,
            reason: "COMPRA_INICIAL",
            channel: "SYSTEM",
            actorId: admin.id,
            note: "Stock inicial de desarrollo (seed)",
          },
        });
        await tx.variant.update({
          where: { id: variant.id },
          data: { stockActual: v.stock, onlineUnits: v.stock },
        });
      });
    }
  }

  // Configuración inicial (las reglas reales de KoraPuntos se cargan del doc del cliente)
  await db.setting.upsert({
    where: { key: "loyalty.rules" },
    update: {},
    create: {
      key: "loyalty.rules",
      value: {
        provisional: true,
        earn: { pointsPer: 1, perAmountCop: 1000 },
        note: "PROVISIONAL — reemplazar con el documento de reglas del cliente antes de S12",
      },
    },
  });
  await db.setting.upsert({
    where: { key: "store.whatsapp" },
    update: {},
    create: { key: "store.whatsapp", value: { phone: "573000000000", provisional: true } },
  });

  const counts = {
    permisos: await db.permission.count(),
    roles: await db.role.count(),
    categorias: await db.category.count(),
    productos: await db.product.count(),
    variantes: await db.variant.count(),
    movimientos: await db.stockMovement.count(),
  };
  console.log("Seed OK:", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
