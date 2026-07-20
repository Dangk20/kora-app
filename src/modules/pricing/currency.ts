// Moneda activa del visitante (TIE_HU001).
//
// Precedencia: elección manual (cookie) > geolocalización por IP > COP.
// La elección manual NUNCA se sobrescribe por la detección.
import { cookies, headers } from "next/headers";
import {
  currencyForCountry,
  DEFAULT_CURRENCY,
  isCurrency,
  type Currency,
} from "./index";

export const CURRENCY_COOKIE = "kora_moneda";
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cabeceras de país que ponen los CDN/proxies más comunes.
 * ⚠️ El VPS con Caddy no las emite todavía: hasta configurar GeoIP, la
 * detección cae al default COP (comportamiento previsto por la HU).
 */
const COUNTRY_HEADERS = [
  "cf-ipcountry", // Cloudflare
  "x-vercel-ip-country",
  "x-geo-country",
];

export async function activeCurrency(): Promise<Currency> {
  const store = await cookies();
  const chosen = store.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(chosen)) return chosen;

  const headerList = await headers();
  for (const name of COUNTRY_HEADERS) {
    const country = headerList.get(name);
    if (country) return currencyForCountry(country);
  }
  return DEFAULT_CURRENCY;
}
