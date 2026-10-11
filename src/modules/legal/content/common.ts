// Frases que se repiten en varios documentos: quién es KORA y qué se acepta.
//
// Escritas UNA vez para que la presentación de las dos sociedades sea idéntica
// en los términos, la política de datos y la información del comercio. Si cada
// documento la redactara a su manera, bastaría una edición en uno para que el
// banco leyera dos versiones distintas de quién cobra.

import { listaDeMarcas, MONEDAS_TARJETA } from "../payments";
import type { Merchant } from "../config";

/** KORA en dos países: la matriz en EE.UU. y la sociedad en Colombia. */
export function presentacionEs(m: Merchant): string {
  return `KORA opera en Estados Unidos y en Colombia. ${m.llc.razonSocial} es la sociedad matriz, constituida en Estados Unidos con registro ${m.llc.registro} y domicilio en ${m.llc.domicilio}. ${m.razonSocial} es su sociedad en Colombia, identificada con NIT ${m.nit}, con ${m.matricula} y domicilio en ${m.domicilio}.`;
}

export function presentacionEn(m: Merchant): string {
  return `KORA operates in the United States and in Colombia. ${m.llc.razonSocial} is the parent company, organized in the United States under registration ${m.llc.registro}, with its registered address at ${m.llc.domicilio}. ${m.razonSocial} is its company in Colombia, identified with Colombian tax ID (NIT) ${m.nit}, registered under ${m.matricula}, with its address at ${m.domicilio}.`;
}

/** Quién figura en el cobro con tarjeta. */
export function cobroTarjetaEs(m: Merchant): string {
  return `Los pagos con tarjeta los procesa ${m.llc.razonSocial}, titular de la cuenta comercial con la que se cobran. Es el comercio que figura en la transacción.`;
}

export function cobroTarjetaEn(m: Merchant): string {
  return `Card payments are processed by ${m.llc.razonSocial}, the holder of the merchant account they are charged through. It is the merchant of record shown on the transaction.`;
}

export const MARCAS_ES = listaDeMarcas("y");
export const MARCAS_EN = listaDeMarcas("and");

const NOMBRE_MONEDA_ES = { COP: "pesos colombianos (COP)", USD: "dólares estadounidenses (USD)" } as const;
const NOMBRE_MONEDA_EN = { COP: "Colombian pesos (COP)", USD: "US dollars (USD)" } as const;

/** "pesos colombianos (COP) y dólares estadounidenses (USD)". */
export const MONEDAS_TARJETA_ES = MONEDAS_TARJETA.map((c) => NOMBRE_MONEDA_ES[c]).join(" y ");
export const MONEDAS_TARJETA_EN = MONEDAS_TARJETA.map((c) => NOMBRE_MONEDA_EN[c]).join(" and ");

/** La versión en inglés es una traducción; en Colombia prevalece la española. */
export const PREVALECE_ESPANOL =
  "This is a translation provided for convenience. For purchases governed by Colombian law, the Spanish version of this document prevails in case of any discrepancy.";
