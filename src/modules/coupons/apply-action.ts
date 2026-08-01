"use server";

// Validación del cupón desde el checkout.
// Ver openspec/changes/modulo-cupones — specs/coupon-redemption.
//
// Vive en el SERVIDOR y recibe solo el código y las líneas del carrito: el
// navegador nunca envía el importe del descuento. Quien calcula es quien
// después crea el pedido, con las mismas funciones.

import { db } from "@/lib/db";
import type { CartLine } from "@/modules/cart/cart-context";
import { resolveCart } from "@/modules/cart/resolve";
import { activeCurrency } from "@/modules/pricing/currency";
import { validateCoupon } from "./validate";

export type ApplyCouponResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: string };

export async function applyCoupon(
  code: string,
  lines: CartLine[],
  buyer: { phone?: string; email?: string },
): Promise<ApplyCouponResult> {
  const limpio = code.trim().toUpperCase();
  if (!limpio) return { ok: false, error: "Escribe un código." };

  const currency = await activeCurrency();
  const cart = await resolveCart(lines, currency);

  const r = await validateCoupon(limpio, cart, buyer, db);
  if (!r.ok) return { ok: false, error: r.message };
  return { ok: true, code: r.coupon.code, discount: r.discount };
}
