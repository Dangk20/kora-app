// Comprobación contable del libro de cashback.
// Ver openspec/changes/kora-cashback — specs/cashback-ledger.
//
// AVISA, NO CORRIGE. Es la misma decisión que en el inventario: un libro
// descuadrado es un síntoma, y corregirlo automáticamente borra la evidencia
// del problema que hay que investigar. Aquí, además, lo descuadrado es dinero.

import { db } from "@/lib/db";
import { aNumero } from "./money";

/** Un saldo materializado que no coincide con la suma de sus movimientos. */
export type BalanceMismatch = {
  customerId: string;
  name: string;
  currency: "COP" | "USD";
  balance: number;
  ledgerSum: number;
};

/** Un lote con el remanente imposible: negativo o mayor que lo acreditado. */
export type LotMismatch = {
  movementId: string;
  customerId: string;
  currency: "COP" | "USD";
  amount: number;
  remaining: number;
};

export type CashbackVerification = {
  balances: BalanceMismatch[];
  lots: LotMismatch[];
  ok: boolean;
};

async function saldosDescuadrados(): Promise<BalanceMismatch[]> {
  const rows = await db.$queryRaw<
    { customerId: string; name: string; currency: string; balance: unknown; ledgerSum: unknown }[]
  >`
    SELECT c.id            AS "customerId",
           c.name          AS "name",
           d.currency      AS "currency",
           d.balance       AS "balance",
           COALESCE(SUM(m.delta), 0) AS "ledgerSum"
    FROM customers c
    CROSS JOIN LATERAL (
      VALUES ('COP', c."cashbackCop"), ('USD', c."cashbackUsd")
    ) AS d(currency, balance)
    LEFT JOIN cashback_movements m
           ON m."customerId" = c.id AND m.currency::text = d.currency
    GROUP BY c.id, c.name, d.currency, d.balance
    HAVING d.balance <> COALESCE(SUM(m.delta), 0)
  `;
  return rows.map((r) => ({
    customerId: r.customerId,
    name: r.name,
    currency: r.currency === "USD" ? "USD" : "COP",
    balance: aNumero(r.balance),
    ledgerSum: aNumero(r.ledgerSum),
  }));
}

async function lotesImposibles(): Promise<LotMismatch[]> {
  const rows = await db.$queryRaw<
    { movementId: string; customerId: string; currency: string; amount: unknown; remaining: unknown }[]
  >`
    SELECT id          AS "movementId",
           "customerId" AS "customerId",
           currency::text AS "currency",
           delta       AS "amount",
           remaining   AS "remaining"
    FROM cashback_movements
    WHERE type = 'EARN'
      AND (remaining IS NULL OR remaining < 0 OR remaining > delta)
  `;
  return rows.map((r) => ({
    movementId: r.movementId,
    customerId: r.customerId,
    currency: r.currency === "USD" ? "USD" : "COP",
    amount: aNumero(r.amount),
    remaining: aNumero(r.remaining),
  }));
}

export async function verifyCashbackLedger(): Promise<CashbackVerification> {
  const [balances, lots] = await Promise.all([saldosDescuadrados(), lotesImposibles()]);
  return { balances, lots, ok: balances.length === 0 && lots.length === 0 };
}

/** Resumen legible del resultado, para el trabajo programado y la consola. */
export function describeVerification(v: CashbackVerification): string {
  if (v.ok) return "el libro de cashback cuadra en todos los clientes";
  const partes: string[] = [];
  if (v.balances.length > 0) {
    partes.push(
      `${v.balances.length} saldo(s) descuadrados: ` +
        v.balances
          .map((b) => `${b.name} ${b.currency} (materializado ${b.balance} vs libro ${b.ledgerSum})`)
          .join("; "),
    );
  }
  if (v.lots.length > 0) {
    partes.push(
      `${v.lots.length} lote(s) con remanente imposible: ` +
        v.lots.map((l) => `${l.movementId} (${l.remaining} de ${l.amount})`).join("; "),
    );
  }
  return partes.join(" · ");
}
