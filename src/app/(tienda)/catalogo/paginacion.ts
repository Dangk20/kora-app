// Lo que comparten la página del catálogo y su "Cargar más": si divergieran,
// la segunda tanda podría salir en otro orden y repetir o saltarse productos.

/**
 * Cuántos productos se pintan de golpe.
 *
 * Sin tope, el catálogo real manda todas las tarjetas en la primera
 * respuesta: cientos de imágenes y un HTML enorme, en un teléfono con datos
 * móviles. El diseño pide **"Cargar más", nunca paginación numérica** (§03).
 */
export const POR_PAGINA = 12;

export const SORTS = ["relevancia", "precioAsc", "precioDesc", "nombre"] as const;
export type Sort = (typeof SORTS)[number];

export function normalizarOrden(orden?: string): Sort {
  return SORTS.includes(orden as Sort) ? (orden as Sort) : "relevancia";
}
