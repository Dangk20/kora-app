// Resolución del contenido de la vitrina.
//
// Una sección en modo MANUAL muestra exactamente lo que el operador eligió.
// En modo AUTO se llena sola con su regla. En ambos casos se filtra por lo
// que la tienda puede mostrar (producto activo con variantes activas), así
// que un producto desactivado desaparece de la vitrina sin tocar nada.
import { db } from "@/lib/db";
import { storage } from "@/modules/storage";
import type { Currency } from "@/modules/pricing";
import { enIdioma, type Locale } from "@/modules/i18n";
import { listProducts, type StoreProduct } from "@/modules/storefront/queries";
import { expandirElementos, productosDeCategoria, TOPE_POR_CATEGORIA, type ElementoSeccion } from "./expand";
import { SECTIONS, type BannerSlot, type SectionKey } from "./sections";

/** Un elemento de una sección manual, tal como lo lista el editor del panel. */
export type EditorItem = {
  id: string;
  kind: "product" | "category";
  /** El producto o la categoría a la que apunta. */
  refId: string;
  /** "Mujer › Short" para una subcategoría. */
  name: string;
  imageUrl: string | null;
  color: string;
  icon: string;
  /** Solo categoría: cuántos productos aporta hoy a la sección. */
  count?: number;
};

export type ResolvedSection = {
  key: SectionKey;
  title: string;
  /** El que escribió el operador (vacío = el de la sección por omisión). */
  titleEn: string | null;
  subtitle: string | null;
  active: boolean;
  mode: "MANUAL" | "AUTO";
  autoRule: string;
  limit: number;
  products: StoreProduct[];
  /** Los elementos guardados (modo manual), para el editor del panel. */
  items: EditorItem[];
};

export type ResolvedBanner = {
  id: string;
  slot: BannerSlot;
  title: string;
  imageUrl: string | null;
  active: boolean;
  href: string | null;
  productName: string | null;
  productId: string | null;
  position: number;
};

/** Crea las filas de las secciones fijas la primera vez que se consultan. */
async function ensureSections() {
  const existing = await db.showcaseSection.findMany({ select: { key: true } });
  const have = new Set(existing.map((s) => s.key));
  const missing = SECTIONS.filter((s) => !have.has(s.key));
  if (missing.length === 0) return;
  await db.showcaseSection.createMany({
    data: missing.map((s) => ({
      key: s.key,
      title: s.title,
      subtitle: s.subtitle ?? null,
      limit: s.limit,
      // Arrancan en automático para que la tienda nunca se vea vacía antes
      // de que el operador arme su vitrina.
      mode: "AUTO" as const,
      autoRule: s.key === "ofertas" ? ("ONLINE_DEAL" as const) : ("NEWEST" as const),
    })),
    skipDuplicates: true,
  });
}

/** Productos de una sección automática, según su regla. */
async function autoProducts(
  rule: string,
  limit: number,
  currency: Currency,
  locale: Locale,
): Promise<StoreProduct[]> {
  const all = await listProducts({ currency, locale });

  switch (rule) {
    case "FEATURED": {
      const featured = all.filter((p) => p.featured);
      return (featured.length > 0 ? featured : all).slice(0, limit);
    }
    case "ONLINE_DEAL": {
      // Con ahorro real frente al precio de tienda en la moneda activa.
      const deals = all.filter((p) =>
        p.variants.some((v) => {
          const store = currency === "COP" ? v.prices.priceCopStore : v.prices.priceUsdStore;
          const online = currency === "COP" ? v.prices.priceCopOnline : v.prices.priceUsdOnline;
          return online > 0 && store > online;
        }),
      );
      return (deals.length > 0 ? deals : all).slice(0, limit);
    }
    case "BEST_SELLERS": {
      const sold = await db.orderItem.groupBy({
        by: ["variantId"],
        where: { order: { status: { in: ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] } } },
        _sum: { qty: true },
      });
      const unitsByVariant = new Map(sold.map((s) => [s.variantId, s._sum.qty ?? 0]));
      const scored = all
        .map((p) => ({
          product: p,
          units: p.variants.reduce((sum, v) => sum + (unitsByVariant.get(v.id) ?? 0), 0),
        }))
        .sort((a, b) => b.units - a.units);
      // Sin ventas todavía, un "más vendidos" vacío se ve peor que el catálogo.
      const withSales = scored.filter((s) => s.units > 0);
      return (withSales.length > 0 ? withSales : scored)
        .slice(0, limit)
        .map((s) => s.product);
    }
    default:
      return all.slice(0, limit); // NEWEST: listProducts ya ordena por reciente
  }
}

export async function getShowcase(
  currency: Currency,
  /** La tienda pasa el del visitante; el panel (Vitrina) se queda en español. */
  locale: Locale = "es",
): Promise<ResolvedSection[]> {
  await ensureSections();

  const rows = await db.showcaseSection.findMany({
    include: {
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          productId: true,
          categoryId: true,
          product: {
            select: {
              name: true,
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              category: { select: { color: true, icon: true } },
            },
          },
          category: {
            select: { name: true, color: true, icon: true, parent: { select: { name: true } } },
          },
        },
      },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  // Un solo viaje al catálogo para todas las secciones manuales, traigan
  // productos sueltos o categorías.
  const hayManuales = rows.some((r) => r.mode === "MANUAL" && r.items.length > 0);
  const catalogo = hayManuales ? await listProducts({ currency, locale }) : [];
  const driver = storage();

  const resolved: ResolvedSection[] = [];
  for (const def of SECTIONS) {
    const row = byKey.get(def.key);
    if (!row) continue;

    const elementos: ElementoSeccion[] = row.items.map((i) =>
      i.categoryId
        ? { kind: "category", categoryId: i.categoryId }
        : { kind: "product", productId: i.productId! },
    );

    const products =
      row.mode === "MANUAL"
        ? // Todos los elegidos: la tienda rota los que no caben a la vez.
          expandirElementos(elementos, catalogo)
        : // En automático se traen varias "páginas" para que el carrusel tenga
          // qué rotar, sin cargar el catálogo entero.
          await autoProducts(row.autoRule, Math.min(row.limit * 2, 12), currency, locale);

    const items: EditorItem[] = row.items.map((i) =>
      i.category
        ? {
            id: i.id,
            kind: "category",
            refId: i.categoryId!,
            name: i.category.parent ? `${i.category.parent.name} › ${i.category.name}` : i.category.name,
            imageUrl: null,
            color: i.category.color,
            icon: i.category.icon,
            count: Math.min(productosDeCategoria(i.categoryId!, catalogo).length, TOPE_POR_CATEGORIA),
          }
        : {
            id: i.id,
            kind: "product",
            refId: i.productId!,
            name: i.product?.name ?? "Producto",
            imageUrl: i.product?.images[0] ? driver.urlFor(i.product.images[0].url) : null,
            color: i.product?.category.color ?? "#FBE3D3",
            icon: i.product?.category.icon ?? "package",
          },
    );

    resolved.push({
      key: def.key,
      title: locale === "en" ? row.titleEn?.trim() || def.titleEn : row.title,
      titleEn: row.titleEn,
      subtitle: row.subtitle,
      active: row.active,
      mode: row.mode,
      autoRule: row.autoRule,
      limit: row.limit,
      products,
      items,
    });
  }
  return resolved;
}

/**
 * Piezas por espacio, en orden. Un espacio puede tener varias: la tienda las
 * rota sola. El panel las lista para agregarlas, editarlas o quitarlas.
 */
export async function getBanners(): Promise<Map<BannerSlot, ResolvedBanner[]>> {
  const rows = await db.banner.findMany({
    include: { product: { select: { slug: true, name: true } } },
    orderBy: [{ slot: "asc" }, { position: "asc" }],
  });
  const driver = storage();
  const now = new Date();

  const map = new Map<BannerSlot, ResolvedBanner[]>();
  for (const b of rows) {
    // Respeta la ventana de vigencia si se configuró.
    const started = !b.startsAt || b.startsAt <= now;
    const notEnded = !b.endsAt || b.endsAt >= now;
    const slot = b.slot as BannerSlot;
    const list = map.get(slot) ?? [];
    list.push({
      id: b.id,
      slot,
      title: b.title,
      imageUrl: b.imageUrl ? driver.urlFor(b.imageUrl) : null,
      active: b.active && started && notEnded,
      href: b.product ? `/producto/${b.product.slug}` : (b.linkUrl ?? null),
      productName: b.product?.name ?? null,
      productId: b.productId,
      position: b.position,
    });
    map.set(slot, list);
  }
  return map;
}

/** Categorías para los accesos redondos del hero. */
export async function getShowcaseCategories(limit = 8, locale: Locale = "es") {
  const categories = await db.category.findMany({
    where: { active: true, parentId: null },
    orderBy: { position: "asc" },
    select: { id: true, name: true, nameEn: true, slug: true, color: true, icon: true },
    take: limit,
  });
  return categories.map(({ nameEn, ...c }) => ({ ...c, name: enIdioma(locale, c.name, nameEn) }));
}
