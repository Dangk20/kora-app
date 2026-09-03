// Candado de la FACTURA ELECTRÓNICA.
//
// **Qué está cerrado y qué no.** El comprobante de pedido funciona: se emite,
// se envía y se descarga. Lo cerrado es la factura electrónica de venta ante la
// DIAN, que es otra cosa: exige habilitación del comerciante como facturador
// electrónico, un proveedor tecnológico, numeración autorizada (prefijo y
// resolución) y datos tributarios que hoy el sistema no tiene.
//
// **Por qué se enseña en vez de esconderse.** Es el criterio de Email
// marketing. Un botón ausente se lee como funcionalidad no contemplada; un
// botón desactivado que dice qué falta le señala al cliente exactamente cuál es
// su parte. Aquí importa más todavía, porque los tres insumos son suyos y
// ninguno se resuelve escribiendo código.
//
// Este archivo NO importa nada.

/** Qué falta, dicho tal cual se le enseña al operador. */
export const FACTURA_ELECTRONICA_PENDIENTE =
  "Falta la habilitación de KORA como facturador electrónico ante la DIAN, " +
  "el proveedor tecnológico que la emita y la numeración autorizada. " +
  "Mientras tanto, cada pedido confirmado genera su comprobante.";

/** La etiqueta del botón. Una sola definición: aparece en dos pantallas. */
export const FACTURA_ELECTRONICA_ETIQUETA = "Factura electrónica";
export const FACTURA_ELECTRONICA_PRONTO = "Muy pronto";
