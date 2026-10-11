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

import type { Locale } from "@/modules/i18n";
import type { Merchant } from "../config";

/** Un párrafo puede llevar énfasis o una lista; nada más. */
export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string };

export type LegalSection = {
  /**
   * Ancla de la sección (`#pago`). Es la MISMA en los dos idiomas: así el
   * selector de idioma conserva la posición y una prueba puede comparar las dos
   * versiones sección por sección.
   */
  id: string;
  heading: string;
  /** Lo esencial de la sección en una o dos frases, en el recuadro destacado. */
  summary?: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: LegalSlug;
  /** Título de la página y de la pestaña. */
  title: string;
  /** Etiqueta corta para listas, footer y menú. */
  shortTitle: string;
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

/**
 * Los documentos, en el orden en que se listan en el centro legal.
 *
 * Los slugs son los mismos en los dos idiomas (`/en/terminos`): cambiar de
 * idioma es cambiar un segmento de la URL, sin tabla de equivalencias que
 * pueda desincronizarse. Los tres primeros conservan su slug histórico para
 * que la redirección desde `korashopp.com/legal/<slug>` sea directa.
 */
export const LEGAL_SLUGS = [
  "terminos",
  "datos-personales",
  "cookies",
  "cambios",
  "envios",
  "seguridad-pagos",
  "promociones",
  "comercio",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/**
 * Un documento se construye con los datos del comerciante, nunca los lleva
 * escritos.
 *
 * Así el mismo contenido sirve en desarrollo (con marcadores) y en producción
 * (con los datos reales) sin duplicar el texto — y duplicarlo sería la forma
 * segura de que uno de los dos se quedara desactualizado.
 */
export type LegalDocumentFactory = (merchant: Merchant, contexto?: LegalContext) => LegalDocument;

/**
 * Datos de contacto que no son del entorno sino de la base: el WhatsApp de
 * atención lo configura el operador en el panel. Opcional para que los
 * documentos se puedan construir en pruebas y en el sitemap sin base.
 */
export type LegalContext = {
  /** WhatsApp de atención en formato E.164 (`+573024456290`). */
  whatsapp?: string | null;
  /**
   * ¿Está encendida la medición publicitaria (Meta / Google)? Gobierna la
   * sección de cookies de la política de privacidad: el texto nunca afirma
   * algo que la tienda no hace, en ninguno de los dos sentidos. Change
   * `medicion-publicitaria`.
   */
  medicion?: boolean;
};

/** Cada documento existe en los dos idiomas de la tienda. */
export type BilingualDocument = Record<Locale, LegalDocumentFactory>;
