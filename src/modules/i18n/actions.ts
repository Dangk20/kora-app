"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./index";

/** Elección manual de idioma: persiste y prevalece sobre la detección. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/", sameSite: "lax" });
  // La tienda se renderiza en servidor: hay que revalidarla entera.
  revalidatePath("/", "layout");
}
