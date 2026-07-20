"use server";

import { activeCurrency } from "@/modules/pricing/currency";
import { resolveCart, type ResolvedCart } from "./resolve";
import type { CartLine } from "./cart-context";

/**
 * El navegador manda variantId+qty; el servidor devuelve producto, precio y
 * disponibilidad reales. Nunca se confía en precios que vengan del cliente.
 */
export async function getResolvedCart(lines: CartLine[]): Promise<ResolvedCart> {
  const currency = await activeCurrency();
  const safe = Array.isArray(lines)
    ? lines
        .filter(
          (l) =>
            l &&
            typeof l.variantId === "string" &&
            Number.isInteger(l.qty) &&
            l.qty > 0 &&
            l.qty <= 999,
        )
        .slice(0, 100)
    : [];
  return resolveCart(safe, currency);
}
