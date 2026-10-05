// Carga las traducciones al inglés del catálogo (change `tienda-en-ingles`).
//
//   pnpm translations:load <archivo.json> [--simular] [--sobrescribir]
//
// El archivo es una lista `{ skus: [...], en: { name, description } }`: cada
// entrada se aplica al PRODUCTO de esos SKU. Idempotente y respetuosa: por
// omisión NO pisa una traducción que ya exista —si el cliente la corrigió en
// el panel, se queda la suya—; `--sobrescribir` la reemplaza.
//
// Las categorías se traducen por su nombre en español con el mapa de abajo,
// porque no tienen SKU. Lo que no esté en el mapa se informa y se deja: en la
// tienda en inglés sale en español hasta que alguien lo traduzca en el panel.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";

const CATEGORIAS: Record<string, string> = {
  // Líneas
  "Hombre": "Men", "Ropa Hombre": "Men's clothing",
  "Mujer": "Women", "Ropa Mujer": "Women's clothing",
  "Niña": "Girls", "Ropa Niña": "Girls' clothing",
  "Niño": "Boys", "Ropa Niño": "Boys' clothing",
  "Bebé niña": "Baby girl", "Ropa Bebé niña": "Baby girl clothing",
  "Bebé niño": "Baby boy", "Ropa Bebé niño": "Baby boy clothing",
  "Maquillaje y belleza": "Makeup & beauty",
  "Juguetes": "Toys", "Regalos": "Gifts",
  // Hombre
  "Camisetas": "T-shirts", "Polos": "Polo shirts",
  "Camisillas y camisetas sin mangas": "Tank tops & sleeveless tees",
  "Pantalonetas ligeras": "Lightweight shorts", "Pantalonetas de punto": "Knit shorts",
  "Bermudas cargo": "Cargo shorts", "Bermudas casuales": "Casual shorts",
  // Maquillaje y belleza
  "Rostro": "Face", "Labios": "Lips", "Ojos": "Eyes", "Brochas y accesorios": "Brushes & accessories",
  // Mujer
  "Falda": "Skirts", "Blusa ligera": "Tops & blouses", "Blusas": "Blouses", "Jean": "Jeans",
  "Short": "Shorts", "Shorts": "Shorts", "Leggings": "Leggings",
  // Niña
  "Vestidos": "Dresses", "Conjunto 2 piezas": "2-piece sets", "Prendas superiores": "Tops",
  "Pantalones": "Pants", "Set 3 piezas": "3-piece sets", "Jeans": "Jeans", "Buzos": "Sweatshirts",
  "Baño": "Swimwear",
  // Niño
  "Camisa texturizada": "Textured shirts", "Camisa ligera": "Lightweight shirts",
  "Camiseta niño": "Boys' T-shirts", "Camiseta toddler": "Toddler T-shirts",
  "Mameluco bebé": "Baby rompers", "Buzo niño": "Boys' hoodies", "Jogger niño": "Boys' joggers",
  "Conjunto niño": "Boys' sets",
  // Bebé
  "Bodys · sets de 3 piezas": "Bodysuits · 3-piece sets", "Bodys · sets": "Bodysuit sets",
  "Enterizos con pies": "Footed sleepers",
  // Juguetes
  "Figuras coleccionables": "Collectible figures", "Vehículos en miniatura": "Die-cast cars",
  "Lanzadores": "Launchers", "Audífonos": "Headphones",
};

type Entrada = { skus: string[]; en: { name: string; description: string } };

async function main() {
  const args = process.argv.slice(2);
  const archivo = args.find((a) => !a.startsWith("--"));
  const simular = args.includes("--simular");
  const sobrescribir = args.includes("--sobrescribir");
  if (!archivo) {
    console.error("Uso: pnpm translations:load <archivo.json> [--simular] [--sobrescribir]");
    process.exit(1);
  }
  const entradas = JSON.parse(readFileSync(archivo, "utf8")) as Entrada[];

  const cuenta = { productos: 0, yaTenian: 0, sinProducto: 0 };
  const vistos = new Set<string>();
  for (const e of entradas) {
    const variante = await db.variant.findFirst({
      where: { sku: { in: e.skus } },
      select: { product: { select: { id: true, nameEn: true, descriptionEn: true } } },
    });
    if (!variante) { cuenta.sinProducto += 1; continue; }
    const p = variante.product;
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    if (!sobrescribir && (p.nameEn || p.descriptionEn)) { cuenta.yaTenian += 1; continue; }
    cuenta.productos += 1;
    if (!simular) {
      await db.product.update({
        where: { id: p.id },
        data: { nameEn: e.en.name.trim() || null, descriptionEn: e.en.description.trim() || null },
      });
    }
  }

  const categorias = await db.category.findMany({ select: { id: true, name: true, nameEn: true } });
  const sinMapa: string[] = [];
  let cats = 0;
  for (const c of categorias) {
    const en = CATEGORIAS[c.name.normalize("NFC").trim()];
    if (!en) { sinMapa.push(c.name); continue; }
    if (!sobrescribir && c.nameEn) continue;
    cats += 1;
    if (!simular) await db.category.update({ where: { id: c.id }, data: { nameEn: en } });
  }

  console.log(
    `Productos traducidos: ${cuenta.productos} · ya tenían traducción (no se tocan): ${cuenta.yaTenian} · SKU sin producto en esta base: ${cuenta.sinProducto}`,
  );
  console.log(`Categorías traducidas: ${cats} · sin traducción en el mapa: ${sinMapa.length ? sinMapa.join(", ") : "ninguna"}`);
  console.log(simular ? "(simulación: no se escribió nada)" : "✔ Aplicado.");
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
