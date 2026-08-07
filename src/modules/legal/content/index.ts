import type { Merchant } from "../config";
import { cambios } from "./cambios";
import { datosPersonales } from "./datos-personales";
import { terminos } from "./terminos";
import { LEGAL_SLUGS, type LegalDocument, type LegalDocumentFactory, type LegalSlug } from "./types";

const DOCUMENTOS: Record<LegalSlug, LegalDocumentFactory> = {
  "datos-personales": datosPersonales,
  terminos,
  cambios,
};

/** ¿Es este slug uno de los tres documentos legales? */
export function esSlugLegal(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

/** El documento con los datos del comerciante ya interpolados. */
export function legalDocument(slug: LegalSlug, merchant: Merchant): LegalDocument {
  return DOCUMENTOS[slug](merchant);
}

/** Los tres, en el orden en que se enlazan en el footer. */
export function allLegalDocuments(merchant: Merchant): LegalDocument[] {
  return LEGAL_SLUGS.map((slug) => DOCUMENTOS[slug](merchant));
}

/**
 * Enlaces para el footer y el sitemap.
 *
 * Las etiquetas son más cortas que los títulos de las páginas: en el footer
 * "Política de tratamiento de datos personales" ocupa una línea entera en
 * móvil. El destino, en cambio, sale de los mismos slugs — así no hay forma de
 * enlazar a una página legal que no exista.
 */
export const LEGAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/legal/datos-personales", label: "Tratamiento de datos" },
  { href: "/legal/terminos", label: "Términos y condiciones" },
  { href: "/legal/cambios", label: "Cambios y garantía" },
];

export { LEGAL_SLUGS };
export type { LegalBlock, LegalDocument, LegalSection, LegalSlug } from "./types";
