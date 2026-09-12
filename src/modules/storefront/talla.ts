// La talla de una pieza única. NO IMPORTA NADA: lo usa la ficha (componente
// cliente) y la tarjeta (servidor). Traerlo desde `product-card.tsx` metía
// Prisma y `pg` en el paquete del navegador y la ficha respondía 500.

/**
 * El nombre de la variante cuando el producto tiene UNA sola y no es "Única":
 * "Talla M", "Talla 32". Con varias, el comprador elige en la ficha.
 */
export function tallaUnica(product: { variants: { name: string }[] }): string | null {
  if (product.variants.length !== 1) return null;
  const n = product.variants[0].name.trim();
  if (!n || /^[uú]nica$/i.test(n)) return null;
  return n;
}
