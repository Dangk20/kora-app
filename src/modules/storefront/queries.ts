// Lectura del catálogo para la tienda pública.
//
// Reglas de visibilidad, en un solo lugar para que ninguna vista se las salte:
//   - Solo productos activos con al menos una variante activa.
//   - "Disponible" = tiene cupo online (`onlineUnits > 0`). El stock físico de
//     la tienda no se vende por la web (motor de inventario, regla 2).
import { db } from "@/lib/db";
import { storage } from "@/modules/storage";
import { resolvePrice, toNumber, type Currency, type VariantPrices } from "@/modules/pricing";

export type StoreVariant = {
  id: string;
  sku: string;
  name: string;
  prices: VariantPrices;
  onlineUnits: number;
};

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  featured: boolean;
  category: { id: string; name: string; slug: string; color: string; icon: string };
  parentCategory: { id: string; name: string; slug: string } | null;
  images: { url: string; alt: string | null }[];
  variants: StoreVariant[];
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  description: true,
  featured: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      icon: true,
      parent: { select: { id: true, name: true, slug: true } },
    },
  },
  images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
  variants: {
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sku: true,
      name: true,
      onlineUnits: true,
      priceCopStore: true,
      priceCopOnline: true,
      priceUsdStore: true,
      priceUsdOnline: true,
    },
  },
} as const;

type RawProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  featured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    color: string;
    icon: string;
    parent: { id: string; name: string; slug: string } | null;
  };
  images: { url: string; alt: string | null }[];
  variants: {
    id: string;
    sku: string;
    name: string;
    onlineUnits: number;
    priceCopStore: unknown;
    priceCopOnline: unknown;
    priceUsdStore: unknown;
    priceUsdOnline: unknown;
  }[];
};

function toStoreProduct(p: RawProduct): StoreProduct {
  const driver = storage();
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    description: p.description,
    featured: p.featured,
    category: {
      id: p.category.id,
      name: p.category.name,
      slug: p.category.slug,
      color: p.category.color,
      icon: p.category.icon,
    },
    parentCategory: p.category.parent,
    images: p.images.map((i) => ({ url: driver.urlFor(i.url), alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      onlineUnits: v.onlineUnits,
      prices: {
        priceCopStore: toNumber(v.priceCopStore),
        priceCopOnline: toNumber(v.priceCopOnline),
        priceUsdStore: toNumber(v.priceUsdStore),
        priceUsdOnline: toNumber(v.priceUsdOnline),
      },
    })),
  };
}

/** Unidades publicadas online sumando las variantes activas. */
export function availableUnits(product: StoreProduct): number {
  return product.variants.reduce((sum, v) => sum + v.onlineUnits, 0);
}

/** Precios vigentes de todas las variantes, para armar el rango de la card. */
export function productAmounts(product: StoreProduct, currency: Currency): number[] {
  return product.variants
    .map((v) => resolvePrice(v.prices, currency))
    .filter((p) => p.available)
    .map((p) => p.amount);
}

export type CatalogFilters = {
  categorySlug?: string;
  search?: string;
  sort?: "relevancia" | "precioAsc" | "precioDesc" | "nombre";
  currency: Currency;
};

export async function listProducts(filters: CatalogFilters): Promise<StoreProduct[]> {
  const where: Record<string, unknown> = {
    active: true,
    variants: { some: { active: true } },
  };

  if (filters.categorySlug) {
    // Una categoría padre incluye lo de sus subcategorías.
    where.category = {
      OR: [
        { slug: filters.categorySlug },
        { parent: { slug: filters.categorySlug } },
      ],
    };
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const rows = (await db.product.findMany({
    where,
    select: PRODUCT_SELECT,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  })) as unknown as RawProduct[];

  const products = rows.map(toStoreProduct);

  // El orden por precio se resuelve en memoria: el precio vigente depende de
  // la moneda activa y del canal, no es una columna que se pueda ordenar en SQL.
  const priceOf = (p: StoreProduct) => {
    const amounts = productAmounts(p, filters.currency);
    return amounts.length ? Math.min(...amounts) : Number.POSITIVE_INFINITY;
  };
  switch (filters.sort) {
    case "precioAsc":
      return [...products].sort((a, b) => priceOf(a) - priceOf(b));
    case "precioDesc":
      return [...products].sort((a, b) => priceOf(b) - priceOf(a));
    case "nombre":
      return [...products].sort((a, b) => a.name.localeCompare(b.name, "es"));
    default:
      return products;
  }
}

export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  const row = (await db.product.findFirst({
    where: { slug, active: true, variants: { some: { active: true } } },
    select: PRODUCT_SELECT,
  })) as unknown as RawProduct | null;
  return row ? toStoreProduct(row) : null;
}

export async function getRelatedProducts(
  product: StoreProduct,
  limit = 4,
): Promise<StoreProduct[]> {
  const rows = (await db.product.findMany({
    where: {
      active: true,
      id: { not: product.id },
      categoryId: product.category.id,
      variants: { some: { active: true } },
    },
    select: PRODUCT_SELECT,
    take: limit,
    orderBy: { createdAt: "desc" },
  })) as unknown as RawProduct[];
  return rows.map(toStoreProduct);
}

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  children: { id: string; name: string; slug: string }[];
  productCount: number;
};

/** Categorías raíz con productos visibles, para el nav y los tiles del home. */
export async function listCategories(): Promise<StoreCategory[]> {
  const categories = await db.category.findMany({
    where: { active: true, parentId: null },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      icon: true,
      children: {
        where: { active: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });

  const counts = await db.product.groupBy({
    by: ["categoryId"],
    where: { active: true, variants: { some: { active: true } } },
    _count: { _all: true },
  });
  const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));

  return categories
    .map((c) => ({
      ...c,
      productCount:
        (countBy.get(c.id) ?? 0) +
        c.children.reduce((sum, ch) => sum + (countBy.get(ch.id) ?? 0), 0),
    }))
    .filter((c) => c.productCount > 0);
}
