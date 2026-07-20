"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isCurrency, type Currency } from "./index";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";

/**
 * Elección manual de moneda (TIE_HU001 §2): persiste y prevalece sobre la
 * detección por IP en visitas futuras.
 */
export async function setCurrency(currency: Currency): Promise<void> {
  if (!isCurrency(currency)) return;
  const store = await cookies();
  store.set(CURRENCY_COOKIE, currency, {
    maxAge: CURRENCY_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
  // Los precios se renderizan en servidor: hay que revalidar toda la tienda.
  revalidatePath("/", "layout");
}
