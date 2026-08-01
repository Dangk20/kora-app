// Los mensajes exactos que ve el comprador (CUP_HU004 §2).
//
// Están en un solo sitio porque son SIETE y están fijados literalmente por la
// historia de usuario: repartidos por el código, uno se desvía sin que nadie lo
// note. Y porque así las pruebas comprueban QUÉ falló —el motivo tipado— y no
// cómo está redactado: corregir una tilde no debería romper once pruebas.

export type RejectionReason =
  | "NOT_FOUND" // no existe o está pausado
  | "NOT_IN_WINDOW" // fuera de vigencia
  | "EXHAUSTED" // agotado
  | "CURRENCY" // moneda no aplicable
  | "NO_ELIGIBLE_ITEMS" // el carrito no tiene nada dentro del alcance
  | "FIRST_PURCHASE_ONLY" // solo primera compra y el cliente ya compró
  | "PER_CUSTOMER_LIMIT"; // alcanzó su máximo por cliente

/** El orden de esta lista ES el orden de evaluación (CUP_HU004 §2). */
export const REASON_ORDER: RejectionReason[] = [
  "NOT_FOUND",
  "NOT_IN_WINDOW",
  "EXHAUSTED",
  "CURRENCY",
  "NO_ELIGIBLE_ITEMS",
  "FIRST_PURCHASE_ONLY",
  "PER_CUSTOMER_LIMIT",
];

export function rejectionMessage(reason: RejectionReason, currency?: string): string {
  switch (reason) {
    case "NOT_FOUND":
      return "Cupón no válido.";
    case "NOT_IN_WINDOW":
      return "Este cupón no está vigente.";
    case "EXHAUSTED":
      return "Este cupón ya alcanzó su límite de usos.";
    case "CURRENCY":
      return `Este cupón no aplica para compras en ${currency ?? "esta moneda"}.`;
    case "NO_ELIGIBLE_ITEMS":
      return "Este cupón no aplica a los productos de tu carrito.";
    case "FIRST_PURCHASE_ONLY":
      return "Este cupón es solo para tu primera compra.";
    case "PER_CUSTOMER_LIMIT":
      return "Ya usaste este cupón el máximo de veces permitido.";
  }
}
