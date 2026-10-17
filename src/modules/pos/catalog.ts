// Catálogo de la caja (change s09-pos-caja). Lo que el cajero ve y puede
// agregar al ticket: variantes activas de productos activos, con el precio de
// TIENDA en COP —el único que cobra el POS— y el stock TOTAL, porque la caja
// vende del pool entero (el cupo online no la bloquea).
import { db } from "@/lib/db";
import { resolvePrice } from "@/modules/pricing";
import { storage } from "@/modules/storage";

export type PosProduct = {
  variantId: string;
  sku: string;
  barcode: string | null;
  productName: string;
  /** Vacío para el producto simple ("Única"). */
  variantName: string;
  categoryId: string;
  price: number;
  stock: number;
  image: string | null;
};

export type PosCategory = { id: string; name: string };

const num = (d: { toString(): string }) => Number(d.toString());

export async function listPosCatalog(): Promise<{ products: PosProduct[]; categories: PosCategory[] }> {
  const variants = await db.variant.findMany({
    where: { active: true, product: { active: true, archivedAt: null } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      stockActual: true,
      priceCopStore: true,
      priceCopOnline: true,
      priceUsdStore: true,
      priceUsdOnline: true,
      product: {
        select: {
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
  });

  // Las pestañas son las categorías de PRIMER nivel: una subcategoría cuenta
  // dentro de su padre, como en la tienda.
  const driver = storage();
  const categorias = new Map<string, string>();
  const products = variants.map((v) => {
    const cat = v.product.category;
    const raiz = cat.parent ?? cat;
    categorias.set(raiz.id, raiz.name);
    const precio = resolvePrice(
      {
        priceCopStore: num(v.priceCopStore),
        priceCopOnline: num(v.priceCopOnline),
        priceUsdStore: num(v.priceUsdStore),
        priceUsdOnline: num(v.priceUsdOnline),
      },
      "COP",
      "store",
    );
    const variante = v.name.trim().toLowerCase();
    return {
      variantId: v.id,
      sku: v.sku,
      barcode: v.barcode,
      productName: v.product.name,
      variantName: variante === "única" || variante === "unica" ? "" : v.name,
      categoryId: raiz.id,
      price: precio.amount,
      stock: v.stockActual,
      image: v.product.images[0] ? driver.urlFor(v.product.images[0].url) : null,
    };
  });

  return {
    products,
    categories: [...categorias].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}
