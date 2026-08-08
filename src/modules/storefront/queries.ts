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
  /** Última modificación real, para el `lastModified` del sitemap. */
  updatedAt: Date;
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
  updatedAt: true,
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
  updatedAt: Date;
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
    updatedAt: p.updatedAt,
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

/**
 * Qué significa "publicado" en la tienda. UNA definición.
 *
 * No basta con `active`: un producto sin ninguna variante activa no se puede
 * comprar, así que no se muestra. Cualquier consulta que declare productos al
 * exterior —el catálogo, el sitemap— parte de aquí; escribir el `where` a mano
 * en otro sitio crearía una segunda definición que se desincroniza en silencio,
 * y el síntoma sería un sitemap lleno de URL que devuelven 404.
 */
export const PUBLICADO = {
  active: true,
  variants: { some: { active: true } },
} as const;

/**
 * Qué cuenta como coincidencia de búsqueda. UNA definición.
 *
 * La comparten la página de resultados y el desplegable del header. Si cada
 * uno tuviera la suya, el desplegable podría encontrar un producto por su SKU
 * y el catálogo no: el visitante haría clic en "ver todos los resultados" y
 * aterrizaría en una página vacía — el peor final para una búsqueda que sí
 * funcionó, y sin ningún error que lo delate.
 *
 * **Por qué es SQL y no un `where` de Prisma.** Prisma sabe comparar sin
 * distinguir mayúsculas, pero no sin distinguir **tildes**, y eso no es un
 * matiz: el catálogo lo carga el cliente a mano y en la misma sesión aparecen
 * "Audífonos", "audifonos" y "AUDIFONOS". Quien busca sin tilde no encuentra el
 * producto con tilde y no ve ningún error — ve una tienda que no tiene lo que
 * sí tiene. `unaccent` resuelve las dos direcciones de una vez.
 *
 * **Qué se busca.** El nombre, la marca, la descripción, la categoría y el SKU
 * y nombre de cada variante, todo en un solo texto por producto. Cada palabra
 * de la consulta tiene que aparecer en ese texto (Y, no O): "audifonos kora"
 * pide los dos, así que añadir palabras afina en vez de ensuciar.
 *
 * **Qué NO decide.** Si el producto está publicado. Devuelve identificadores y
 * quien llama les aplica `PUBLICADO`: la definición de "publicado" sigue
 * viviendo en un solo sitio, aquí arriba.
 *
 * **Techo conocido.** Recorre la tabla entera en cada consulta. Con unos miles
 * de productos es cuestión de milisegundos; si el catálogo creciera un orden de
 * magnitud, esto pasa a ser una columna materializada con índice GIN. No se
 * hace hoy porque sería optimizar un problema que no existe.
 */
export async function searchMatchingIds(raw: string): Promise<string[]> {
  const palabras = raw.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const filas = await db.$queryRaw<{ id: string }[]>`
    WITH doc AS (
      SELECT
        p.id,
        unaccent(lower(
          coalesce(p.name, '') || ' ' ||
          coalesce(p.brand, '') || ' ' ||
          coalesce(p.description, '') || ' ' ||
          coalesce(c.name, '') || ' ' ||
          coalesce(string_agg(coalesce(v.sku, '') || ' ' || coalesce(v.name, ''), ' '), '')
        )) AS texto
      FROM products p
      LEFT JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN variants v ON v."productId" = p.id
      GROUP BY p.id, c.name
    )
    SELECT id FROM doc
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(${palabras}::text[]) AS palabra
      -- \`strpos\` y no \`LIKE\`: con LIKE habría que escapar los % y _ que
      -- escriba el visitante, y un % sin escapar convierte la búsqueda en
      -- "tráemelo todo".
      WHERE strpos(doc.texto, unaccent(lower(palabra))) = 0
    )
  `;

  return filas.map((f) => f.id);
}

/**
 * Slug y fecha de modificación de cada producto publicado, para el sitemap.
 *
 * Existe aparte de `listProducts` a propósito: aquélla resuelve las URL de las
 * imágenes contra el driver de almacenamiento, y el sitemap no necesita
 * imágenes. Reutilizarla obligaba a tener R2 configurado para generar un
 * archivo de texto con slugs — y tumbaba el build.
 */
export async function listProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db.product.findMany({
    where: PUBLICADO,
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listProducts(filters: CatalogFilters): Promise<StoreProduct[]> {
  const where: Record<string, unknown> = { ...PUBLICADO };

  if (filters.categorySlug) {
    // Una categoría padre incluye lo de sus subcategorías.
    where.category = {
      OR: [
        { slug: filters.categorySlug },
        { parent: { slug: filters.categorySlug } },
      ],
    };
  }
  if (filters.search?.trim()) {
    // El filtro de texto se resuelve aparte y entra como lista de ids: así el
    // desplegable del header y esta página no pueden encontrar cosas distintas.
    where.id = { in: await searchMatchingIds(filters.search) };
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
