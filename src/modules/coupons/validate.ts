// Las OCHO validaciones del canje, EN SU ORDEN.
// Ver openspec/changes/modulo-cupones — specs/coupon-redemption.
//
// El orden importa porque el mensaje es lo único que el comprador ve.
// Comprobar el carrito antes que la vigencia le diría "no aplica a tus
// productos" sobre un cupón que en realidad venció, y se iría a cambiar el
// carrito para nada.

import { db } from "@/lib/db";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { computeDiscount, eligibleLines, fixedAmountFor, type CouponForDiscount } from "./discount";
import { rejectionMessage, type RejectionReason } from "./messages";
import { isRedeemable } from "./status";

type Db = typeof db;

export type CouponSnapshot = CouponForDiscount & {
  id: string;
  code: string;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
  firstPurchaseOnly: boolean;
  freeVariantId: string | null;
  minSubtotalCop: number | null;
  minSubtotalUsd: number | null;
};

export type ValidationOk = {
  ok: true;
  coupon: CouponSnapshot;
  discount: number;
  freeVariantId: string | null;
};
export type ValidationFail = { ok: false; reason: RejectionReason; message: string };
export type ValidationResult = ValidationOk | ValidationFail;

/** Contacto del formulario, para las reglas que dependen del cliente. */
export type BuyerContact = { phone?: string | null; email?: string | null };

function fail(
  reason: RejectionReason,
  currency?: string,
  minimum?: number,
): ValidationFail {
  return { ok: false, reason, message: rejectionMessage(reason, currency, minimum) };
}

/**
 * Compra mínima que exige el cupón en la moneda del carrito, o null si no exige.
 *
 * Gemela de `fixedAmountFor`: NUNCA se convierte de una moneda a la otra. Un
 * cupón con mínimo solo en COP no impone nada a una compra en USD — imponer el
 * importe en pesos sobre dólares sería exigir ~4.000 veces más.
 */
function minSubtotalFor(coupon: CouponSnapshot, currency: string): number | null {
  const valor = currency === "USD" ? coupon.minSubtotalUsd : coupon.minSubtotalCop;
  return valor && valor > 0 ? valor : null;
}

export async function loadCoupon(code: string, client: Db = db): Promise<CouponSnapshot | null> {
  const c = await client.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { categories: true, products: true },
  });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    percentValue: c.percentValue === null ? null : Number(c.percentValue),
    amountCop: c.amountCop === null ? null : Number(c.amountCop),
    amountUsd: c.amountUsd === null ? null : Number(c.amountUsd),
    scope: c.scope,
    categoryIds: c.categories.map((x) => x.categoryId),
    productIds: c.products.map((x) => x.productId),
    appliesToSaleItems: c.appliesToSaleItems,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    perCustomerLimit: c.perCustomerLimit,
    validFrom: c.validFrom,
    validTo: c.validTo,
    active: c.active,
    firstPurchaseOnly: c.firstPurchaseOnly,
    freeVariantId: c.freeVariantId,
    minSubtotalCop: c.minSubtotalCop === null ? null : Number(c.minSubtotalCop),
    minSubtotalUsd: c.minSubtotalUsd === null ? null : Number(c.minSubtotalUsd),
  };
}

/**
 * Valida un cupón contra un carrito y un contacto.
 *
 * Se usa DOS veces: al aplicar (para la experiencia) y al crear el pedido (que
 * es la que decide). Entre una y otra puede cambiar todo — el cupón puede
 * agotarse por otro comprador o pausarse desde el panel — y por eso la segunda
 * no es opcional.
 */
export async function validateCoupon(
  code: string,
  cart: ResolvedCart,
  buyer: BuyerContact,
  client: Db = db,
  now: Date = new Date(),
): Promise<ValidationResult> {
  const coupon = await loadCoupon(code, client);

  // 1. No existe o está pausado.
  if (!coupon || !coupon.active) return fail("NOT_FOUND");

  // 2. Fuera de vigencia.
  if (coupon.validFrom && coupon.validFrom.getTime() > now.getTime()) {
    return fail("NOT_IN_WINDOW");
  }
  if (coupon.validTo && coupon.validTo.getTime() < now.getTime()) {
    return fail("NOT_IN_WINDOW");
  }

  // 3. Agotado.
  if (!isRedeemable(coupon, now)) return fail("EXHAUSTED");

  // 4. Moneda no aplicable: solo afecta al monto fijo. Un porcentaje aplica a
  //    cualquier moneda, y el producto gratis tampoco depende de la divisa.
  if (coupon.type === "FIXED" && fixedAmountFor(coupon, cart.currency) === null) {
    return fail("CURRENCY", cart.currency);
  }

  // 5. Compra mínima no alcanzada (petición del cliente, 7 ago 2026).
  //
  //    Va DESPUÉS de la moneda porque el mínimo es por divisa —COP y USD no se
  //    convierten— y antes del alcance porque es lo más fácil de arreglar para
  //    el comprador: "te faltan $X" es accionable; "no aplica a tus productos"
  //    ya no.
  //
  //    ⚠️ Se compara contra el SUBTOTAL, no contra el total tras descuentos. Si
  //    se midiera después de aplicar el propio cupón, uno de $20.000 sobre un
  //    mínimo de $100.000 se invalidaría a sí mismo al aplicarse: válido antes,
  //    inválido después, y el comprador vería el descuento aparecer y
  //    desaparecer sin entender por qué.
  const minimo = minSubtotalFor(coupon, cart.currency);
  if (minimo !== null && cart.subtotal < minimo) {
    return fail("BELOW_MINIMUM", cart.currency, minimo);
  }

  // 6. Sin ítems elegibles según el alcance (o todos excluidos por estar en
  //    oferta con el interruptor apagado).
  if (eligibleLines(coupon, cart).length === 0) return fail("NO_ELIGIBLE_ITEMS");

  // 7 y 8 dependen de reconocer al cliente por el contacto del formulario.
  const phone = buyer.phone?.trim() || null;
  const email = buyer.email?.trim().toLowerCase() || null;
  const customer =
    phone || email
      ? await client.customer.findFirst({
          where: { OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])] },
          select: { id: true },
        })
      : null;

  if (customer) {
    // 7. Solo primera compra.
    if (coupon.firstPurchaseOnly) {
      const previos = await client.order.count({
        where: {
          customerId: customer.id,
          status: { in: ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] },
        },
      });
      if (previos > 0) return fail("FIRST_PURCHASE_ONLY");
    }

    // 8. Máximo por cliente.
    if (coupon.perCustomerLimit !== null) {
      const usados = await client.couponRedemption.count({
        where: { couponId: coupon.id, customerId: customer.id },
      });
      if (usados >= coupon.perCustomerLimit) return fail("PER_CUSTOMER_LIMIT");
    }
  }

  const { amount } = computeDiscount(coupon, cart);
  return { ok: true, coupon, discount: amount, freeVariantId: coupon.freeVariantId };
}
