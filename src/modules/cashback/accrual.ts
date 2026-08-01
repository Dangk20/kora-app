// Cuánto cashback genera una compra.
// Ver openspec/changes/kora-cashback — specs/cashback-accrual.
//
// Es una función pura: no consulta la base ni decide cuándo acreditar. El
// cuándo lo decide el manejador de `order.confirmed`; el cuánto vive aquí para
// que la regla del cliente esté en un solo sitio y se pueda probar sola.

import type { Currency } from "@/generated/prisma/enums";
import { TASA_CASHBACK, truncar } from "./money";

export type AccrualInput = {
  /** Total del pedido: el snapshot inmutable, ya con cupones descontados. */
  total: number;
  /**
   * Parte del total pagada con saldo de cashback.
   *
   * Hoy siempre es 0: la redención en el checkout es un change aparte. Cuando
   * exista, el pedido tendrá que guardar cuánto se pagó con saldo y ese valor
   * entra por aquí — la fórmula ya lo contempla.
   */
  cashbackApplied?: number;
  currency: Currency;
};

/**
 * Base de cálculo: el dinero REALMENTE pagado.
 *
 * Se parte del total del pedido y no de sus líneas porque el total es lo que el
 * operador va a cobrar por WhatsApp: recalcular la base desde los ítems abriría
 * la puerta a generar cashback sobre un número distinto del que se cobró.
 */
export function accrualBase(input: AccrualInput): number {
  const pagadoConDinero = input.total - (input.cashbackApplied ?? 0);
  return Math.max(0, pagadoConDinero);
}

/**
 * El 3 % del dinero pagado, truncado hacia abajo.
 *
 * La regla que el cliente precisó el 1 ago 2026: el cashback se genera
 * únicamente sobre lo pagado con dinero, después de cupones, promociones y del
 * propio cashback. Calcularlo sobre el total incluyendo la parte pagada con
 * saldo crea un ciclo en el que el beneficio se recompensa a sí mismo, y el
 * programa se financia solo hacia abajo hasta que alguien lo nota en la caja.
 *
 * Una compra cubierta al 100 % con saldo genera CERO — y eso hay que decirlo
 * en la interfaz, o el comprador lo lee como un error.
 */
export function computeAccrual(input: AccrualInput): number {
  return truncar(accrualBase(input) * TASA_CASHBACK, input.currency);
}
