// Idioma activo de la petición en curso y su diccionario. Aparte de `index.ts`
// porque importa `next/headers`.
import { cookies } from "next/headers";
import { origenDeLaPeticion } from "@/modules/geo/request";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./index";
import { MESSAGES, type Messages } from "./messages";

export async function activeLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value, await origenDeLaPeticion());
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await activeLocale()];
}
