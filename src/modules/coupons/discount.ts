// Cálculo del descuento de un cupón.
// Ver openspec/changes/modulo-cupones — specs/coupon-redemption.
//
// Recibe el carrito YA RESUELTO por el servidor y no consulta precios por su
// cuenta. `resolvePrice()` es la única fuente de precio del proyecto: si este
// módulo consultara por separado, bastaría un precio online que cambió entre
// dos consultas para que el descuento no cuadre con lo que el comprador vio —
// y en un flujo donde el pago se acuerda por WhatsApp, ese descuadre lo
// descubre el operador cobrando.

import type { ResolvedCart, ResolvedLine } from "@/modules/cart/resolve";
import type { CouponScope, CouponType } from "@/generated/prisma/enums";

export type CouponForDiscount = {
  type: CouponType;
  percentValue: number | null;
  amountCop: number | null;
  amountUsd: number | null;
  scope: CouponScope;
  categoryIds: string[];
  productIds: string[];
  appliesToSaleItems: boolean;
};

/**
 * Ítems sobre los que puede caer el descuento.
 *
 * Dos filtros: el alcance del cupón y —si el interruptor está apagado— la
 * exclusión de lo que ya está rebajado. Un cupón que no admite ofertas y un
 * carrito enteramente en oferta deja cero elegibles, y eso es un rechazo, no
 * un descuento de cero.
 */
export function eligibleLines(
  coupon: CouponForDiscount,
  cart: ResolvedCart,
): ResolvedLine[] {
  return cart.lines.filter((l) => {
    if (l.unavailable || l.qtyAvailable === 0) return false;
    if (!coupon.appliesToSaleItems && l.hasOnlineDiscount) return false;
    switch (coupon.scope) {
      case "ALL":
        return true;
      case "CATEGORIES":
        return coupon.categoryIds.includes(l.categoryId);
      case "PRODUCTS":
        return coupon.productIds.includes(l.productId);
    }
  });
}

export function eligibleSubtotal(coupon: CouponForDiscount, cart: ResolvedCart): number {
  return eligibleLines(coupon, cart).reduce((sum, l) => sum + l.lineTotal, 0);
}

/** El importe de un cupón de monto fijo en la moneda del pedido. `null` = no aplica. */
export function fixedAmountFor(
  coupon: CouponForDiscount,
  currency: string,
): number | null {
  // Nunca se convierte de una moneda a la otra: son dos importes que decidió
  // el negocio, no uno derivado del otro. Es la misma regla que rige los
  // precios del catálogo.
  const valor = currency === "USD" ? coupon.amountUsd : coupon.amountCop;
  return valor && valor > 0 ? valor : null;
}

export type DiscountResult = {
  /** Importe descontado, siempre ≥ 0 y nunca mayor que el subtotal elegible. */
  amount: number;
  eligibleSubtotal: number;
  /** Para "producto gratis": la variante que hay que añadir al pedido. */
  freeVariantId: string | null;
};

/**
 * Calcula el descuento.
 *
 * El total NUNCA queda negativo: un cupón de monto fijo mayor que el carrito
 * descuenta como mucho el subtotal elegible. Un cupón no genera saldo a favor —
 * y si lo generara, en un cobro por WhatsApp nadie sabría qué hacer con él.
 */
export function computeDiscount(
  coupon: CouponForDiscount,
  cart: ResolvedCart,
): DiscountResult {
  const base = eligibleSubtotal(coupon, cart);

  if (coupon.type === "FREE_PRODUCT") {
    // El regalo no descuenta importe: entra como línea con precio cero, para
    // que su stock lo descuente el motor de inventario al confirmar, igual que
    // cualquier otro ítem.
    return { amount: 0, eligibleSubtotal: base, freeVariantId: null };
  }

  if (coupon.type === "PERCENT") {
    const pct = coupon.percentValue ?? 0;
    const bruto = (base * pct) / 100;
    return { amount: redondear(Math.min(bruto, base), cart.currency), eligibleSubtotal: base, freeVariantId: null };
  }

  const fijo = fixedAmountFor(coupon, cart.currency) ?? 0;
  return {
    amount: redondear(Math.min(fijo, base), cart.currency),
    eligibleSubtotal: base,
    freeVariantId: null,
  };
}

/**
 * Redondeo del importe descontado.
 *
 * En pesos no se manejan centavos; en dólares sí. Se trunca hacia abajo para
 * que el descuento nunca supere lo calculado: en un cobro fuera de la
 * plataforma, un peso de más a favor del comprador es una discusión.
 */
function redondear(valor: number, currency: string): number {
  return currency === "USD" ? Math.floor(valor * 100) / 100 : Math.floor(valor);
}
