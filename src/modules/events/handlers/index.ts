// Manejadores registrados. Añadir un consumidor nuevo es añadirlo aquí:
// el motor de consumo no cambia.

import { handlersFor, registerHandler, registeredTypes } from "../registry";
import type { EventHandler } from "../types";
import { orderConfirmedCashbackHandler } from "./order-confirmed-cashback";
import { orderConfirmedLogHandler } from "./order-confirmed-log";
import {
  orderCancelledBuyerEmail,
  orderConfirmedBuyerEmail,
  orderCreatedBuyerEmail,
  orderCreatedStaffEmail,
  orderDeliveredBuyerEmail,
  orderPreparingBuyerEmail,
  orderShippedBuyerEmail,
} from "./order-emails";

/** Registra un manejador si no está ya. */
function registrar(tipo: string, handler: EventHandler): void {
  if (handlersFor(tipo).some((h) => h.name === handler.name)) return;
  registerHandler(tipo, handler);
}

/**
 * Registra todos los manejadores. Idempotente: llamarla dos veces no duplica.
 *
 * Lo idempotente se comprueba contra EL REGISTRO, no contra una bandera de este
 * módulo: una bandera sería un segundo estado que se desincroniza en cuanto
 * alguien vacía el registro —lo que hacen las pruebas— y dejaría el sistema
 * creyendo que hay manejadores donde ya no hay ninguno.
 */
export function registerAllHandlers(): void {
  registrar("order.confirmed", orderConfirmedLogHandler);
  registrar("order.confirmed", orderConfirmedCashbackHandler);

  // Correos. Van DESPUÉS del cashback en el orden de registro para que el
  // correo de confirmación encuentre el saldo ya acreditado y pueda decir
  // cuánto ganó el comprador.
  // Uno por CADA estado del pedido: el comprador no tiene otra ventana a su
  // compra, y cada cambio sin avisar es una pregunta por WhatsApp que alguien
  // contesta a mano (decisión del cliente, 1 ago 2026).
  registrar("order.created", orderCreatedBuyerEmail);
  registrar("order.created", orderCreatedStaffEmail);
  registrar("order.confirmed", orderConfirmedBuyerEmail);
  registrar("order.preparing", orderPreparingBuyerEmail);
  registrar("order.shipped", orderShippedBuyerEmail);
  registrar("order.delivered", orderDeliveredBuyerEmail);
  registrar("order.cancelled", orderCancelledBuyerEmail);
}

export { registeredTypes };
