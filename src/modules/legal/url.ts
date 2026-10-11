// Dónde vive el centro legal. UNA definición, como `storeUrl()`.
//
// En producción el centro legal tiene su propio subdominio
// (`legal.korashopp.com`, change `centro-legal`); en desarrollo y en pruebas
// no hay DNS para eso y se sirve bajo `/legal` del mismo host. Si cada enlace
// —footer, checkout, correos, sitemap— construyera su dirección a mano, el día
// del cambio de subdominio uno quedaría apuntando al sitio viejo, sin error.
//
// Se lee del entorno EN TIEMPO DE EJECUCIÓN y no de un `NEXT_PUBLIC_*`: la
// imagen se compila una vez y corre en los dos entornos, y una variable pública
// quedaría grabada en el build. Sin dependencias de Next: la usan el
// middleware, el worker (correos) y las pruebas.

import type { Locale } from "@/modules/i18n";
import type { LegalSlug } from "./content/types";

/** Prefijo de las rutas del centro legal dentro de la aplicación. */
export const LEGAL_PREFIX = "/legal";

/** `https://legal.korashopp.com`, o `null` si el entorno no tiene subdominio legal. */
export function legalBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.KORA_LEGAL_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/** El host del subdominio legal (`legal.korashopp.com`), o `null`. */
export function legalHost(env: NodeJS.ProcessEnv = process.env): string | null {
  const base = legalBase(env);
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return null;
  }
}

/** ¿Llega esta petición por el subdominio legal? */
export function esHostLegal(host: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const legal = legalHost(env);
  return Boolean(legal && host && host.toLowerCase() === legal.toLowerCase());
}

function ruta(locale: Locale, slug?: LegalSlug, ancla?: string): string {
  return `/${locale}${slug ? `/${slug}` : ""}${ancla ? `#${ancla}` : ""}`;
}

/**
 * Dirección pública de un documento (o del índice, sin `slug`), lista para un
 * enlace desde FUERA del centro legal: la tienda, un correo, el sitemap.
 *
 * Con subdominio: `https://legal.korashopp.com/en/terminos`.
 * Sin él: `/legal/en/terminos`, relativa al host de la tienda (o absoluta
 * contra `storeBase` si se pasa, para los correos).
 */
export function legalUrl(
  locale: Locale,
  slug?: LegalSlug,
  opts: { ancla?: string; storeBase?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  const base = legalBase(opts.env);
  const path = ruta(locale, slug, opts.ancla);
  if (base) return `${base}${path}`;
  return `${opts.storeBase ?? ""}${LEGAL_PREFIX}${path}`;
}

/**
 * Enlace entre páginas DEL centro legal: relativo al host en que se está.
 * En el subdominio la ruta pública no lleva `/legal` (el middleware lo añade
 * por dentro); en el host de la tienda sí.
 */
export function legalHref(enSubdominio: boolean, locale: Locale, slug?: LegalSlug, ancla?: string): string {
  return `${enSubdominio ? "" : LEGAL_PREFIX}${ruta(locale, slug, ancla)}`;
}
