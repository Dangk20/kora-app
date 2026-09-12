// Consultas de lectura del cashback de un cliente.
// Ver openspec/changes/kora-cashback — specs/cashback-ledger.
//
// Solo lee. Nada de aquí modifica un saldo: eso vive en `ledger.ts` y en
// ningún otro sitio.

import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { computeAccrual } from "./accrual";
import { aNumero, SALDO_CERO, type CashbackBalance } from "./money";

export type LotView = {
  id: string;
  amount: number;
  remaining: number;
  currency: Currency;
  orderId: string | null;
  orderNumber: number | null;
  expiresAt: Date;
};

export type MovementView = {
  id: string;
  delta: number;
  currency: Currency;
  type: "EARN" | "REDEEM" | "EXPIRE" | "ADJUST";
  orderId: string | null;
  orderNumber: number | null;
  note: string | null;
  createdAt: Date;
};

/** Saldo disponible: el materializado, que el libro respalda. */
export async function cashbackBalance(customerId: string): Promise<CashbackBalance> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: { cashbackCop: true, cashbackUsd: true },
  });
  if (!c) return SALDO_CERO;
  return { cop: aNumero(c.cashbackCop), usd: aNumero(c.cashbackUsd) };
}

/** Lotes vigentes, del más próximo a vencer al más lejano. */
export async function activeLots(customerId: string, now: Date = new Date()): Promise<LotView[]> {
  const lotes = await db.cashbackMovement.findMany({
    where: { customerId, type: "EARN", remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: [{ expiresAt: "asc" }],
    include: { order: { select: { number: true } } },
  });
  return lotes.map((l) => ({
    id: l.id,
    amount: aNumero(l.delta),
    remaining: aNumero(l.remaining),
    currency: l.currency,
    orderId: l.orderId,
    orderNumber: l.order?.number ?? null,
    expiresAt: l.expiresAt as Date,
  }));
}

/** La fecha en que vence el próximo lote de esa moneda, o null si no hay. */
export async function nextExpiry(
  customerId: string,
  currency: Currency,
  now: Date = new Date(),
): Promise<Date | null> {
  const l = await db.cashbackMovement.findFirst({
    where: { customerId, currency, type: "EARN", remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    select: { expiresAt: true },
  });
  return l?.expiresAt ?? null;
}

/** Historial: ganado, usado y vencido, del más reciente al más antiguo. */
export async function cashbackHistory(customerId: string, limit = 50): Promise<MovementView[]> {
  const movs = await db.cashbackMovement.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { order: { select: { number: true } } },
  });
  return movs.map((m) => ({
    id: m.id,
    delta: aNumero(m.delta),
    currency: m.currency,
    type: m.type,
    orderId: m.orderId,
    orderNumber: m.order?.number ?? null,
    note: m.note,
    createdAt: m.createdAt,
  }));
}

/**
 * Lo generado y lo usado EN TOTAL, por moneda. Las dos cifras que el cliente
 * pidió ver sueltas (12 sep 2026): hoy estaban en el historial, sin sumar, y
 * el comprador tendría que sumarlas a mano. Salen del libro, nada nuevo se
 * guarda. Un ajuste positivo cuenta como generado y uno negativo como usado:
 * es lo que el comprador vio entrar y salir.
 */
export type CashbackTotals = { earned: CashbackBalance; used: CashbackBalance };

export async function cashbackTotals(customerId: string): Promise<CashbackTotals> {
  const filas = await db.cashbackMovement.groupBy({
    by: ["currency", "type"],
    where: { customerId },
    _sum: { delta: true },
  });
  const earned = { cop: 0, usd: 0 };
  const used = { cop: 0, usd: 0 };
  for (const f of filas) {
    const v = aNumero(f._sum.delta ?? 0);
    const bolsa = f.currency === "COP" ? "cop" : "usd";
    if (f.type === "EARN" || (f.type === "ADJUST" && v > 0)) earned[bolsa] += v;
    // REDEEM y ADJUST negativo son lo que salió por decisión del comprador o
    // del negocio. EXPIRE no es "usado": es lo que se perdió, y ya se ve en
    // el historial como tal.
    if (f.type === "REDEEM" || (f.type === "ADJUST" && v < 0)) used[bolsa] += Math.abs(v);
  }
  return { earned, used };
}

export type CashbackSummary = {
  available: CashbackBalance;
  pending: CashbackBalance;
  totals: CashbackTotals;
  /** Próximo vencimiento por moneda; null si esa bolsa está vacía. */
  nextExpiry: { cop: Date | null; usd: Date | null };
  history: MovementView[];
};

/**
 * Todo lo que el módulo de clientes necesita mostrar, en una consulta.
 *
 * Va junto a propósito: disponible sin pendiente hace creer al operador que la
 * compra recién hecha no generó nada, y disponible sin vencimiento no permite
 * responder la pregunta que el cliente hace por WhatsApp.
 */
export async function cashbackSummary(
  customerId: string,
  now: Date = new Date(),
): Promise<CashbackSummary> {
  const [available, pending, totals, cop, usd, history] = await Promise.all([
    cashbackBalance(customerId),
    pendingCashback(customerId, now),
    cashbackTotals(customerId),
    nextExpiry(customerId, "COP", now),
    nextExpiry(customerId, "USD", now),
    cashbackHistory(customerId, 12),
  ]);
  return { available, pending, totals, nextExpiry: { cop, usd }, history };
}

/**
 * Cashback PENDIENTE: el de los pedidos creados que aún no se confirman.
 *
 * Se DERIVA de los pedidos vigentes; no genera lotes ni movimientos. Guardarlo
 * obligaría a limpiarlo cuando el pedido expira, y un pedido expirado que
 * dejara su lote sería saldo fantasma. Derivándolo, la expiración lo hace
 * desaparecer sin que nadie tenga que acordarse.
 *
 * No es gastable: es lo que el comprador va a tener en cuanto el operador
 * confirme. Mostrarlo evita que crea que su compra no generó nada.
 */
export async function pendingCashback(
  customerId: string,
  now: Date = new Date(),
): Promise<CashbackBalance> {
  const pedidos = await db.order.findMany({
    where: {
      customerId,
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { total: true, currency: true },
  });

  let cop = 0;
  let usd = 0;
  for (const p of pedidos) {
    const monto = computeAccrual({ total: aNumero(p.total), currency: p.currency });
    if (p.currency === "USD") usd += monto;
    else cop += monto;
  }
  return { cop, usd };
}
