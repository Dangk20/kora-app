// Sugerencias del buscador del header (prototipo aprobado, zona Tienda).
//
// **Por qué existe aparte de `listProducts`.** El desplegable se dispara con
// cada tecla: pedirle al catálogo completo —que resuelve las imágenes de todas
// las variantes y ordena en memoria por precio— sería traer un camión para
// llevar una carta. Aquí se selecciona lo justo que pinta una fila: marca,
// nombre, una imagen y un precio.
//
// **Lo que NO cambia.** El `where` de publicado es el MISMO (`PUBLICADO`), el
// criterio de coincidencia es el MISMO (`searchWhere`) y el precio sale de
// `resolvePrice()`, igual que en la ficha y el carrito. Un buscador que enseñe
// un producto despublicado, o un precio que no es el que se va a cobrar, es
// peor que no tener buscador.
//
// Las constantes y los tipos viven en `search-types.ts` porque los necesita el
// componente cliente: importarlos de aquí le arrastraría Prisma al navegador.

import { db } from "@/lib/db";
import { resolvePrice, toNumber, type Currency } from "@/modules/pricing";
import { storage } from "@/modules/storage";
import { PUBLICADO, searchMatchingIds } from "./queries";
import {
  normalizeQuery,
  SEARCH_SUGGESTION_LIMIT,
  type SearchSuggestions,
} from "./search-types";

type RawSuggestion = {
  slug: string;
  name: string;
  brand: string | null;
  images: { url: string; alt: string | null }[];
  variants: {
    priceCopStore: unknown;
    priceCopOnline: unknown;
    priceUsdStore: unknown;
    priceUsdOnline: unknown;
  }[];
};

export async function searchSuggestions(
  raw: string | null | undefined,
  currency: Currency,
): Promise<SearchSuggestions> {
  const query = normalizeQuery(raw);
  if (!query) return { query: "", items: [], total: 0 };

  const where = { ...PUBLICADO, id: { in: await searchMatchingIds(query) } };

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        slug: true,
        name: true,
        brand: true,
        images: {
          select: { url: true, alt: true },
          orderBy: { position: "asc" },
          take: 1,
        },
        variants: {
          where: { active: true },
          select: {
            priceCopStore: true,
            priceCopOnline: true,
            priceUsdStore: true,
            priceUsdOnline: true,
          },
        },
      },
      // Destacados primero, igual que el catálogo: si el negocio decidió que
      // algo se ve antes, se ve antes también aquí.
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: SEARCH_SUGGESTION_LIMIT,
    }) as unknown as Promise<RawSuggestion[]>,
    db.product.count({ where }),
  ]);

  const driver = storage();

  return {
    query,
    total,
    items: rows.map((row) => {
      // El precio de la fila es el de la variante más barata disponible, el
      // mismo criterio que la tarjeta del catálogo.
      const precios = row.variants
        .map((v) =>
          resolvePrice(
            {
              priceCopStore: toNumber(v.priceCopStore),
              priceCopOnline: toNumber(v.priceCopOnline),
              priceUsdStore: toNumber(v.priceUsdStore),
              priceUsdOnline: toNumber(v.priceUsdOnline),
            },
            currency,
          ),
        )
        .filter((p) => p.available);
      const price = precios.length
        ? precios.reduce((a, b) => (b.amount < a.amount ? b : a))
        : null;

      const img = row.images[0];
      return {
        slug: row.slug,
        name: row.name,
        brand: row.brand,
        image: img ? { url: driver.urlFor(img.url), alt: img.alt } : null,
        price,
      };
    }),
  };
}
