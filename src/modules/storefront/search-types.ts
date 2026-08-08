// Forma y límites de las sugerencias del buscador.
//
// **Este archivo NO importa nada.** Es deliberado: lo consume el componente
// cliente del header (`(tienda)/search-box.tsx`) y también el servidor. Si las
// constantes vivieran en `search.ts` —que importa `db` y el driver de
// almacenamiento—, pedir un número desde el navegador arrastraría Prisma y
// `node:fs` al paquete del cliente y el build fallaría. Es exactamente el
// mismo error que ya se pagó una vez con `storage/limits.ts`; se separa antes
// de cometerlo, no después.

import type { ResolvedPrice } from "@/modules/pricing";

/** Cuántas filas enseña el desplegable. El resto vive en `/catalogo`. */
export const SEARCH_SUGGESTION_LIMIT = 6;

/**
 * Con una sola letra, "a" trae medio catálogo y ninguna de las seis filas es
 * la que el visitante quería. Se espera a la segunda.
 */
export const SEARCH_MIN_LENGTH = 2;

/**
 * Tope de longitud de la consulta. No es una regla de producto: el endpoint es
 * público y sin él una cadena de 10 KB se convierte en cuatro `ILIKE` sobre la
 * tabla entera por cada pulsación.
 */
export const SEARCH_MAX_LENGTH = 80;

export type SearchSuggestion = {
  slug: string;
  name: string;
  brand: string | null;
  image: { url: string; alt: string | null } | null;
  /** `null` cuando ninguna variante tiene precio en la moneda activa. */
  price: ResolvedPrice | null;
};

export type SearchSuggestions = {
  /** Lo que se buscó, ya normalizado — es lo que se enseña entre comillas. */
  query: string;
  items: SearchSuggestion[];
  /** Total de coincidencias, para el botón "Ver todos los resultados (N)". */
  total: number;
};

/** Deja la consulta en su forma canónica, o `null` si no vale la pena buscar. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_LENGTH);
  return q.length >= SEARCH_MIN_LENGTH ? q : null;
}
