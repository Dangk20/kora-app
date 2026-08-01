// Cuánto cashback genera una compra.
// Ver openspec/changes/kora-cashback — specs/cashback-accrual.
//
// Es una función pura: no consulta la base ni decide cuándo acreditar. El
// cuándo lo decide el manejador de `order.confirmed`; el cuánto vive aquí para
// que la regla del cliente esté en un solo sitio y se pueda probar sola.

import type { Currency } from "@/generated/prisma/enums";
import { TASA_CASHBACK, truncar } from "./money";

export type AccrualInput = {
  /**
   * El total del pedido: exactamente lo que el operador va a cobrar.
   *
   * ⚠️ YA VIENE NETO de cupones **y de cashback aplicado** — `createOrder()` lo
   * guarda así. No hay que restarle nada aquí: hacerlo descontaría el saldo dos
   * veces y el comprador recibiría menos cashback del que le corresponde.
   */
  total: number;
  currency: Currency;
};

/**
 * Base de cálculo: el dinero REALMENTE pagado.
 *
 * Es el total del pedido, y no la suma de sus líneas, porque el total es lo que
 * el operador cobra por WhatsApp: recalcular la base desde los ítems abriría la
 * puerta a generar cashback sobre un número distinto del que se cobró. Y como
 * ese total ya viene con el cupón y el cashback descontados, es literalmente lo
 * que el comprador pagó con dinero.
 */
export function accrualBase(input: AccrualInput): number {
  return Math.max(0, input.total);
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
