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

/**
 * El nombre de una variante tal como se enseña al comprador. En la base vive
 * en español ("Talla M", "Única"), porque lo escribe el importador y lo leen
 * el panel, el pedido y WhatsApp; en la tienda en inglés solo se traduce la
 * palabra "Talla" — el valor (M, 32, 6/9M) no tiene idioma.
 */
export function etiquetaVariante(name: string, locale: "es" | "en"): string {
  if (locale !== "en") return name;
  return name.replace(/^talla(\s+)/i, "Size$1").replace(/^[uú]nica$/i, "One size");
}
