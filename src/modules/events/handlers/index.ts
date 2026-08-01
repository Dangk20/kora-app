// Manejadores registrados. Añadir un consumidor nuevo es añadirlo aquí:
// el motor de consumo no cambia.

import { registerHandler, registeredTypes } from "../registry";
import { orderConfirmedLogHandler } from "./order-confirmed-log";

let listo = false;

/** Registra todos los manejadores. Idempotente: llamarla dos veces no duplica. */
export function registerAllHandlers(): void {
  if (listo) return;
  registerHandler("order.confirmed", orderConfirmedLogHandler);
  // ▼ Próximo: acreditación de Kora Cashback (change aparte — su modelo de
  //   datos todavía depende del plazo de la ventana de cambios).
  listo = true;
}

export { registeredTypes };
