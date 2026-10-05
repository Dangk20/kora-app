// Idioma de la tienda (change `tienda-en-ingles`, 5 oct 2026).
//
// Anclado al MISMO origen que la moneda (`src/modules/geo/`): desde fuera de
// Colombia, inglés; desde Colombia o sin saberlo, español. Toda duda cae del
// lado español, igual que la moneda cae del lado COP. Pura: sin `next/headers`,
// para poder probarla.
import type { Origen } from "@/modules/geo";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "kora_idioma";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function localeForOrigin(origen: Origen): Locale {
  return origen === "exterior" ? "en" : "es";
}

/** Precedencia: elección manual > origen. La detección nunca pisa la elección. */
export function resolveLocale(elegido: string | undefined, origen: Origen): Locale {
  return isLocale(elegido) ? elegido : localeForOrigin(origen);
}

/**
 * Texto de catálogo en el idioma pedido, con caída al español: un producto sin
 * traducir se ve en español, nunca vacío.
 */
export function enIdioma(locale: Locale, es: string, en: string | null | undefined): string {
  return locale === "en" && en?.trim() ? en.trim() : es;
}
