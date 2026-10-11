import type { Locale } from "@/modules/i18n";
import type { Merchant } from "../config";
import { cambios } from "./cambios";
import { comercio } from "./comercio";
import { datosPersonales } from "./datos-personales";
import { envios } from "./envios";
import { promociones } from "./promociones";
import { seguridadPagos } from "./seguridad-pagos";
import { terminos } from "./terminos";
import {
  LEGAL_SLUGS,
  type BilingualDocument,
  type LegalContext,
  type LegalDocument,
  type LegalSlug,
} from "./types";

const DOCUMENTOS: Record<LegalSlug, BilingualDocument> = {
  terminos,
  "datos-personales": datosPersonales,
  cambios,
  envios,
  "seguridad-pagos": seguridadPagos,
  promociones,
  comercio,
};

/** ¿Es este slug uno de los documentos legales? */
export function esSlugLegal(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

/** El documento en ese idioma, con los datos del comerciante ya interpolados. */
export function legalDocument(
  slug: LegalSlug,
  merchant: Merchant,
  locale: Locale = "es",
  contexto?: LegalContext,
): LegalDocument {
  return DOCUMENTOS[slug][locale](merchant, contexto);
}

/** Todos, en el orden del centro legal. */
export function allLegalDocuments(merchant: Merchant, locale: Locale = "es", contexto?: LegalContext): LegalDocument[] {
  return LEGAL_SLUGS.map((slug) => legalDocument(slug, merchant, locale, contexto));
}

export { LEGAL_SLUGS };
export type { LegalBlock, LegalContext, LegalDocument, LegalSection, LegalSlug } from "./types";
