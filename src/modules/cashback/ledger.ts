// EL LIBRO DE KORA CASHBACK — mismo patrón que el motor de inventario, con dinero.
// Ver openspec/changes/kora-cashback — specs/cashback-ledger.
//
// Este módulo es EL ÚNICO CAMINO por el que un saldo de cashback puede cambiar.
// Toda mutación:
//   1. Bloquea la fila del cliente (SELECT ... FOR UPDATE) — serializa a los
//      competidores: el worker acreditando y un checkout consumiendo pueden
//      caer sobre el mismo cliente a la vez.
//   2. Escribe el movimiento en el libro (cashback_movements).
//   3. Materializa el saldo del cliente DENTRO DE LA MISMA TRANSACCIÓN.
//
// Es la regla 1 del proyecto aplicada a dinero: un saldo que no cuadra con su
// libro es un pasivo que nadie puede auditar — no se sabe si sobra porque se
// acreditó de más o falta porque se consumió sin registrar.

import type { Prisma } from "@/generated/prisma/client";
import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { aNumero, columnaSaldo, truncar, vencimientoDesde } from "./money";

type Tx = Prisma.TransactionClient;

export class CashbackError extends Error {
  constructor(
    public readonly code:
      | "INSUFFICIENT" // no alcanza el saldo en esa moneda
      | "INVALID_AMOUNT" // importe no positivo o no representable
      | "CUSTOMER_NOT_FOUND",
    public readonly customerId: string,
    public readonly available?: number,
  ) {
    super(`${code}:${customerId}`);
    this.name = "CashbackError";
  }
}

/** Un lote acreditado, tal como lo devuelve el libro. */
export type CashbackLot = {
  id: string;
  amount: number;
  remaining: number;
  currency: Currency;
  orderId: string | null;
  expiresAt: Date;
  createdAt: Date;
};

/**
 * Bloquea la fila del cliente. Aquí se serializa quién toca su saldo.
 * Devuelve el saldo actual en la moneda pedida.
 */
async function bloquearCliente(
  tx: Tx,
  customerId: string,
  currency: Currency,
): Promise<number> {
  const columna = columnaSaldo(currency);
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "${columna}" AS saldo FROM customers WHERE id = $1 FOR UPDATE`,
    customerId,
  );
  if (rows.length === 0) throw new CashbackError("CUSTOMER_NOT_FOUND", customerId);
  return aNumero(rows[0].saldo);
}

/** Mueve el saldo materializado. Solo se llama junto a su movimiento. */
async function materializar(
  tx: Tx,
  customerId: string,
  currency: Currency,
  delta: number,
): Promise<void> {
  const columna = columnaSaldo(currency);
  await tx.customer.update({
    where: { id: customerId },
    data: { [columna]: { increment: delta } },
  });
}

// ─────────────────────────────────────────────────────────────
// ACREDITAR
// ─────────────────────────────────────────────────────────────

export type CreditInput = {
  customerId: string;
  /** Importe ya calculado y truncado por `accrual.ts`. */
  amount: number;
  currency: Currency;
  orderId?: string;
  note?: string;
  /** Solo para pruebas: permite fabricar lotes con vencimiento en el pasado. */
  now?: Date;
};

/**
 * Acredita cashback abriendo un LOTE con su propio vencimiento.
 *
 * DEBE ejecutarse dentro de una transacción abierta: el movimiento y la
 * materialización son la misma escritura o no son ninguna.
 *
 * Sin lotes no habría vencimiento posible: con un saldo único no se puede
 * responder qué parte cumple 12 meses el mes que viene ni distinguir el saldo
 * que caduca del que acaba de entrar.
 */
export async function creditCashback(tx: Tx, input: CreditInput): Promise<CashbackLot> {
  const amount = truncar(input.amount, input.currency);
  if (amount <= 0) throw new CashbackError("INVALID_AMOUNT", input.customerId);

  await bloquearCliente(tx, input.customerId, input.currency);

  const ahora = input.now ?? new Date();
  const mov = await tx.cashbackMovement.create({
    data: {
      customerId: input.customerId,
      delta: amount,
      currency: input.currency,
      type: "EARN",
      orderId: input.orderId ?? null,
      remaining: amount,
      expiresAt: vencimientoDesde(ahora),
      note: input.note ?? null,
      createdAt: ahora,
    },
  });

  await materializar(tx, input.customerId, input.currency, amount);

  return {
    id: mov.id,
    amount,
    remaining: amount,
    currency: input.currency,
    orderId: mov.orderId,
    expiresAt: mov.expiresAt as Date,
    createdAt: mov.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// CONSUMIR
// ─────────────────────────────────────────────────────────────

export type ConsumeInput = {
  customerId: string;
  amount: number;
  currency: Currency;
  orderId?: string;
  note?: string;
  now?: Date;
};

export type ConsumeResult = {
  consumed: number;
  /** Qué lote aportó cuánto — el rastro que permite auditar y recalcular. */
  fromLots: { lotId: string; amount: number }[];
};

/**
 * Gasta cashback del lote MÁS PRÓXIMO A VENCER hacia el más nuevo.
 *
 * Consumir el más nuevo primero dejaría el saldo antiguo caducando mientras el
 * cliente cree que lo está usando: le haría perder dinero que sí tenía.
 *
 * Si el disponible no alcanza, no se toca ningún lote. Un consumo a medias
 * dejaría al comprador con un descuento que el operador no puede cobrar.
 */
export async function consumeCashback(tx: Tx, input: ConsumeInput): Promise<ConsumeResult> {
  const amount = truncar(input.amount, input.currency);
  if (amount <= 0) throw new CashbackError("INVALID_AMOUNT", input.customerId);

  await bloquearCliente(tx, input.customerId, input.currency);
  const ahora = input.now ?? new Date();

  const lotes = await tx.cashbackMovement.findMany({
    where: {
      customerId: input.customerId,
      currency: input.currency,
      type: "EARN",
      remaining: { gt: 0 },
      expiresAt: { gt: ahora },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });

  const disponible = lotes.reduce((s, l) => s + aNumero(l.remaining), 0);
  if (disponible < amount) {
    throw new CashbackError("INSUFFICIENT", input.customerId, disponible);
  }

  const fromLots: { lotId: string; amount: number }[] = [];
  let porGastar = amount;

  for (const lote of lotes) {
    if (porGastar <= 0) break;
    const restante = aNumero(lote.remaining);
    const toma = Math.min(restante, porGastar);

    await tx.cashbackMovement.create({
      data: {
        customerId: input.customerId,
        delta: -toma,
        currency: input.currency,
        type: "REDEEM",
        orderId: input.orderId ?? null,
        sourceMovementId: lote.id,
        note: input.note ?? null,
        createdAt: ahora,
      },
    });
    await tx.cashbackMovement.update({
      where: { id: lote.id },
      data: { remaining: { decrement: toma } },
    });

    fromLots.push({ lotId: lote.id, amount: toma });
    porGastar -= toma;
  }

  await materializar(tx, input.customerId, input.currency, -amount);
  return { consumed: amount, fromLots };
}

// ─────────────────────────────────────────────────────────────
// VENCER
// ─────────────────────────────────────────────────────────────

export type ExpireResult = {
  lots: number;
  /** Importe vencido por moneda, sin sumarlas. */
  cop: number;
  usd: number;
};

/**
 * Vence los lotes que cumplieron su vigencia.
 *
 * Vencer escribe un MOVIMIENTO negativo y deja el remanente en cero: no borra
 * ni edita el lote. Si venciera borrando, el libro dejaría de explicar el saldo
 * y un cliente que reclama "yo tenía cashback" no tendría respuesta; con el
 * movimiento se sabe cuánto venció, cuándo y de qué compra venía.
 *
 * Abre una transacción por cliente: un cliente con el libro raro no impide que
 * los demás venzan.
 */
export async function expireCashback(now: Date = new Date()): Promise<ExpireResult> {
  const vencidos = await db.cashbackMovement.findMany({
    where: { type: "EARN", remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  const total: ExpireResult = { lots: 0, cop: 0, usd: 0 };

  for (const { customerId } of vencidos) {
    const r = await db.$transaction(async (tx) => expirarCliente(tx, customerId, now));
    total.lots += r.lots;
    total.cop += r.cop;
    total.usd += r.usd;
  }

  return total;
}

async function expirarCliente(tx: Tx, customerId: string, now: Date): Promise<ExpireResult> {
  const res: ExpireResult = { lots: 0, cop: 0, usd: 0 };

  for (const currency of ["COP", "USD"] as const) {
    await bloquearCliente(tx, customerId, currency);

    const lotes = await tx.cashbackMovement.findMany({
      where: {
        customerId,
        currency,
        type: "EARN",
        remaining: { gt: 0 },
        expiresAt: { lte: now },
      },
    });
    if (lotes.length === 0) continue;

    let vencido = 0;
    for (const lote of lotes) {
      const restante = aNumero(lote.remaining);
      await tx.cashbackMovement.create({
        data: {
          customerId,
          delta: -restante,
          currency,
          type: "EXPIRE",
          sourceMovementId: lote.id,
          note: `venció el ${lote.expiresAt?.toISOString().slice(0, 10)}`,
          createdAt: now,
        },
      });
      await tx.cashbackMovement.update({ where: { id: lote.id }, data: { remaining: 0 } });
      vencido += restante;
      res.lots += 1;
    }

    await materializar(tx, customerId, currency, -vencido);
    if (currency === "USD") res.usd += vencido;
    else res.cop += vencido;
  }

  return res;
}
