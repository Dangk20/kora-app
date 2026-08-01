// Cuánto cashback puede aplicar un comprador a una compra.
// Ver openspec/changes/canje-cashback — specs/cashback-redemption.
//
// El tope es una función PURA: se puede probar sola y da el mismo resultado en
// el checkout que en la pantalla. El descuento nunca lo fija el navegador —
// misma regla que ya rige los cupones y los precios.

import type { Currency } from "@/generated/prisma/enums";
import { cashbackBalance } from "./balance";
import { enMoneda, truncar } from "./money";

export type RedemptionRejection =
  | "NO_SESSION" // sin cuenta no se puede gastar: la identidad sería un correo escrito
  | "NO_BALANCE" // no hay saldo en esa moneda
  | "WITH_COUPON" // regla del cliente: o cupón o cashback
  | "NOT_REQUESTED";

export const MENSAJE_RECHAZO: Record<RedemptionRejection, string> = {
  NO_SESSION: "Entra a tu cuenta para usar tu Kora Cashback.",
  NO_BALANCE: "No tienes saldo de Kora Cashback disponible en esta moneda.",
  WITH_COUPON: "No puedes usar un cupón y tu Kora Cashback en la misma compra.",
  NOT_REQUESTED: "No aplicaste Kora Cashback.",
};

export type RedemptionInput = {
  /** Lo que pidió aplicar el comprador. */
  requested: number;
  /** Saldo disponible en la moneda del pedido. */
  available: number;
  /** Total del pedido antes de aplicar cashback. */
  orderTotal: number;
  currency: Currency;
};

export type RedemptionResult =
  | { ok: true; amount: number }
  | { ok: false; reason: RedemptionRejection; message: string };

/**
 * El importe realmente aplicable.
 *
 * El menor entre lo pedido, el disponible y el total: el cashback no genera
 * saldo a favor, y en un cobro que se cierra fuera de la plataforma nadie
 * sabría qué hacer con un vuelto.
 */
export function applicableAmount(input: RedemptionInput): RedemptionResult {
  const pedido = truncar(input.requested, input.currency);
  if (pedido <= 0) {
    return { ok: false, reason: "NOT_REQUESTED", message: MENSAJE_RECHAZO.NOT_REQUESTED };
  }
  if (input.available <= 0) {
    return { ok: false, reason: "NO_BALANCE", message: MENSAJE_RECHAZO.NO_BALANCE };
  }

  const tope = Math.min(pedido, input.available, input.orderTotal);
  const amount = truncar(tope, input.currency);

  if (amount <= 0) {
    return { ok: false, reason: "NO_BALANCE", message: MENSAJE_RECHAZO.NO_BALANCE };
  }
  return { ok: true, amount };
}

/** El saldo del comprador en la moneda del pedido. Nunca mezcla divisas. */
export async function availableFor(customerId: string, currency: Currency): Promise<number> {
  return enMoneda(await cashbackBalance(customerId), currency);
}

/**
 * Decide el descuento en el servidor, con el saldo leído del libro.
 *
 * `hasCoupon` corta antes que nada: la interfaz debe impedir elegir los dos,
 * pero la petición no tiene por qué venir de la interfaz.
 */
export async function resolveRedemption(args: {
  customerId: string | null;
  requested: number;
  orderTotal: number;
  currency: Currency;
  hasCoupon: boolean;
}): Promise<RedemptionResult> {
  if (args.requested <= 0) {
    return { ok: false, reason: "NOT_REQUESTED", message: MENSAJE_RECHAZO.NOT_REQUESTED };
  }
  if (args.hasCoupon) {
    return { ok: false, reason: "WITH_COUPON", message: MENSAJE_RECHAZO.WITH_COUPON };
  }
  if (!args.customerId) {
    return { ok: false, reason: "NO_SESSION", message: MENSAJE_RECHAZO.NO_SESSION };
  }

  const available = await availableFor(args.customerId, args.currency);
  return applicableAmount({
    requested: args.requested,
    available,
    orderTotal: args.orderTotal,
    currency: args.currency,
  });
}
