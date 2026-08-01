// Los importes de Kora Cashback y sus dos bolsas.
// Ver openspec/changes/kora-cashback — specs/cashback-ledger.
//
// Aquí vive la única regla de redondeo del módulo y el tipo del saldo. Ambos
// existen por el mismo motivo: impedir que un descuido se convierta en dinero.

import type { Currency } from "@/generated/prisma/enums";

/** Vigencia de un lote de cashback, en meses (regla del cliente). */
export const VIGENCIA_MESES = 12;

/** Porcentaje que genera cada compra sobre el dinero realmente pagado. */
export const TASA_CASHBACK = 0.03;

/**
 * Saldo de un cliente.
 *
 * NO es un número: son dos bolsas. No existe tasa de cambio en KORA y es
 * deliberado —cada divisa usa su propio precio cargado—, así que un total que
 * mezclara pesos y dólares sería un número sin significado que además
 * *parecería* correcto. Con este tipo, sumarlas no compila sin que alguien
 * decida hacerlo a propósito.
 */
export type CashbackBalance = {
  readonly cop: number;
  readonly usd: number;
};

export const SALDO_CERO: CashbackBalance = { cop: 0, usd: 0 };

/** Lee la bolsa de una moneda. Es el único acceso a un saldo por divisa. */
export function enMoneda(balance: CashbackBalance, currency: Currency): number {
  return currency === "USD" ? balance.usd : balance.cop;
}

/** Construye un saldo poniendo el importe en la bolsa de su moneda. */
export function saldoDe(amount: number, currency: Currency): CashbackBalance {
  return currency === "USD" ? { cop: 0, usd: amount } : { cop: amount, usd: 0 };
}

/**
 * Redondeo de un importe de cashback: SIEMPRE hacia abajo.
 *
 * En pesos no hay centavos; en dólares sí. Se trunca porque el programa lo
 * paga el negocio: es la misma regla que ya rige el descuento de los cupones,
 * y tenerla escrita en un solo sitio es lo que evita que cada punto del código
 * redondee a su manera y los saldos dejen de cuadrar por céntimos que nadie
 * sabe de dónde salieron.
 */
export function truncar(valor: number, currency: Currency): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return currency === "USD" ? Math.floor(valor * 100) / 100 : Math.floor(valor);
}

/** Acepta el Decimal de Prisma, un string o un number. */
export function aNumero(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return Number.NaN;
}

/** La columna materializada que corresponde a una moneda. */
export function columnaSaldo(currency: Currency): "cashbackCop" | "cashbackUsd" {
  return currency === "USD" ? "cashbackUsd" : "cashbackCop";
}

/** Fecha de vencimiento de un lote acreditado en `desde`. */
export function vencimientoDesde(desde: Date): Date {
  const d = new Date(desde);
  d.setMonth(d.getMonth() + VIGENCIA_MESES);
  return d;
}

/** Formato para pantalla. Nunca combina las dos monedas en un solo número. */
export function formatearCashback(valor: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(valor);
}
