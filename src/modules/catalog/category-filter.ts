// Filtro de categoría en dos pasos (Daniel, 17 oct 2026): primero la categoría
// principal y, si se quiere, una subcategoría de ESA categoría. La categoría
// sola incluye todas sus subcategorías: "Mujer" trae también "Mujer › Blusas".
import { db } from "@/lib/db";

/** El `categoryId` para el `where` del producto, o `undefined` si no hay filtro. */
export async function categoryIdFilter(
  categoria?: string,
  subcategoria?: string,
): Promise<string | { in: string[] } | undefined> {
  if (subcategoria) return subcategoria;
  if (!categoria) return undefined;
  const hijas = await db.category.findMany({ where: { parentId: categoria }, select: { id: true } });
  return { in: [categoria, ...hijas.map((h) => h.id)] };
}
