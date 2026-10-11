// Qué se acepta con tarjeta: una sola definición para los textos legales, el
// footer de la tienda y el centro legal.
//
// Las redes de tarjetas exigen que el sitio diga qué marcas acepta (con su
// logotipo a todo color) y en qué monedas cobra. Si eso se escribiera en cada
// texto, el día que cambie el contrato con el banco el footer diría una cosa y
// la política otra. Aquí cambia una vez. Change `centro-legal`.

import type { Currency } from "@/modules/pricing";

/** Monedas en que el pago alojado cobra con tarjeta (Daniel, 10 oct 2026). */
export const MONEDAS_TARJETA: readonly Currency[] = ["COP", "USD"];

export type MarcaTarjeta = {
  id: "visa" | "mastercard" | "amex";
  nombre: string;
  /** Logotipo oficial a todo color, servido desde `public/`. */
  logo: string;
};

/**
 * Marcas contratadas con el banco. Una marca que no esté aquí no se muestra en
 * ninguna parte: exhibir el logotipo de una red que no se acepta es tan
 * incumplimiento como no exhibir el de una que sí.
 */
export const MARCAS_ACEPTADAS: readonly MarcaTarjeta[] = [
  { id: "visa", nombre: "Visa", logo: "/marcas/visa.svg" },
  { id: "mastercard", nombre: "Mastercard", logo: "/marcas/mastercard.svg" },
  { id: "amex", nombre: "American Express", logo: "/marcas/amex.svg" },
];

/** "Visa, Mastercard y American Express" / "Visa, Mastercard and American Express". */
export function listaDeMarcas(conjuncion: "y" | "and"): string {
  const nombres = MARCAS_ACEPTADAS.map((m) => m.nombre);
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} ${conjuncion} ${nombres.at(-1)}`;
}

/**
 * Transferencias que se coordinan por WhatsApp (Daniel, 10 oct 2026): no pasan
 * por el pago alojado, pero el sitio las anuncia y el footer las agrupa por
 * país, porque cada una solo sirve a quien tiene cuenta en ese país.
 */
export type MedioTransferencia = {
  id: "nequi" | "bre-b" | "zelle";
  nombre: string;
  pais: "CO" | "US";
  moneda: Currency;
  /** `null` mientras no haya logotipo oficial: se muestra el nombre. */
  logo: string | null;
};

export const MEDIOS_TRANSFERENCIA: readonly MedioTransferencia[] = [
  { id: "nequi", nombre: "Nequi", pais: "CO", moneda: "COP", logo: "/marcas/nequi.svg" },
  // Sello oficial pendiente: ver public/marcas/LEEME.txt.
  { id: "bre-b", nombre: "Bre-B", pais: "CO", moneda: "COP", logo: null },
  { id: "zelle", nombre: "Zelle", pais: "US", moneda: "USD", logo: "/marcas/zelle.svg" },
];

/** "Nequi y Bre-B" — los medios de un país, para los textos. */
export function transferenciasDe(pais: "CO" | "US", conjuncion: "y" | "and"): string {
  const nombres = MEDIOS_TRANSFERENCIA.filter((m) => m.pais === pais).map((m) => m.nombre);
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} ${conjuncion} ${nombres.at(-1)}`;
}
