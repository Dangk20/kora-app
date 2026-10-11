// Lo que el centro legal necesita saber de la petición en curso. Aparte de
// `url.ts` porque importa `next/headers` y la base.

import { headers } from "next/headers";
import type { Locale } from "@/modules/i18n";
import { whatsappNumberFor } from "@/modules/orders/settings";
import type { LegalContext } from "./content";
import { esHostLegal } from "./url";

/** ¿Se está sirviendo esta página por el subdominio legal? */
export async function enSubdominioLegal(): Promise<boolean> {
  const h = await headers();
  return esHostLegal(h.get("host"));
}

/**
 * Contexto de contacto para los documentos. El WhatsApp sale de la misma
 * fuente que el header de la tienda y los pedidos: si el operador lo cambia
 * en el panel, cambia aquí también. En inglés, el de la línea en USD.
 */
export async function legalContext(locale: Locale): Promise<LegalContext> {
  return { whatsapp: await whatsappNumberFor(locale === "en" ? "USD" : "COP") };
}
