// El contenido legal como datos tipados, no como Markdown ni como filas de una
// tabla editable desde el panel.
//
// Por qué datos y no Markdown: se puede escribir una prueba que compruebe que
// la política de cambios menciona el derecho de retracto, o que el plazo
// publicado coincide con la constante real del sistema. Sobre texto plano eso
// exige volver a parsear; sobre datos es una línea.
//
// Por qué no editable desde el panel: una política que cambia sin diff, sin
// revisión y sin fecha es un riesgo legal mayor que la incomodidad de desplegar.
// El historial de estos archivos ES el historial de las políticas.

import type { Merchant } from "../config";

/** Un párrafo puede llevar énfasis o una lista; nada más. */
export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: LegalSlug;
  /** Título de la página y de la pestaña. */
  title: string;
  /** Una línea bajo el título, para orientar antes de leer. */
  summary: string;
  /**
   * Fecha de última actualización, en ISO.
   *
   * Se escribe a mano al editar el documento. Es lo más parecido a versionar
   * la política que hay hoy: el sistema no guarda qué versión aceptó cada
   * comprador (deuda declarada en las notas técnicas privadas), así que al
   * menos la página dice desde cuándo rige lo que se está leyendo.
   */
  updatedAt: string;
  sections: LegalSection[];
};

export const LEGAL_SLUGS = ["datos-personales", "terminos", "cambios"] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/**
 * Un documento se construye con los datos del comerciante, nunca los lleva
 * escritos.
 *
 * Así el mismo contenido sirve en desarrollo (con marcadores) y en producción
 * (con los datos reales) sin duplicar el texto — y duplicarlo sería la forma
 * segura de que uno de los dos se quedara desactualizado.
 */
export type LegalDocumentFactory = (merchant: Merchant) => LegalDocument;
