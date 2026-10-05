// Convierte los elementos de una sección manual en los productos que ve el
// visitante. Pura a propósito: recibe el catálogo publicado ya cargado, así se
// prueba sin base y `getShowcase` sigue haciendo un solo viaje al catálogo.

/** Lo mínimo que se necesita de un producto para expandir. */
export type ProductoExpandible = {
  id: string;
  category: { id: string };
  parentCategory: { id: string } | null;
};

export type ElementoSeccion =
  | { kind: "product"; productId: string }
  | { kind: "category"; categoryId: string };

/**
 * Tope de productos que aporta CADA categoría. Es lo que el modo automático
 * trae para rotar (`limit × 2`, máx. 12): sin tope, "Mujer" metería más de
 * cien productos en la portada.
 */
export const TOPE_POR_CATEGORIA = 12;

/** Productos publicados de una categoría; un padre incluye sus subcategorías. */
export function productosDeCategoria<P extends ProductoExpandible>(
  categoryId: string,
  catalogo: P[],
): P[] {
  return catalogo.filter(
    (p) => p.category.id === categoryId || p.parentCategory?.id === categoryId,
  );
}

/**
 * Elementos en su orden → productos sin repetir. Un producto que aparece
 * suelto y también por su categoría se muestra una vez, donde aparece
 * primero. Lo que no está publicado (no está en `catalogo`) no se muestra.
 * El orden dentro de una categoría es el del catálogo.
 */
export function expandirElementos<P extends ProductoExpandible>(
  elementos: ElementoSeccion[],
  catalogo: P[],
): P[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const vistos = new Set<string>();
  const salida: P[] = [];
  const agregar = (p: P | undefined) => {
    if (!p || vistos.has(p.id)) return;
    vistos.add(p.id);
    salida.push(p);
  };

  for (const e of elementos) {
    if (e.kind === "product") agregar(porId.get(e.productId));
    else productosDeCategoria(e.categoryId, catalogo).slice(0, TOPE_POR_CATEGORIA).forEach(agregar);
  }
  return salida;
}
