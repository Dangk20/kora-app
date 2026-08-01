// Devolución del cashback de un pedido que no prosperó.
// Ver openspec/changes/canje-cashback — specs/cashback-redemption.
//
// ⚠️ DEVUELVE A LOS LOTES ORIGINALES. Nunca crea un lote nuevo.
//
// Si creara uno, un saldo a punto de caducar recuperaría 12 meses de vida, y
// bastaría crear y abandonar pedidos para renovarlo indefinidamente: cashback
// que el negocio ya dio por vencido volvería a ser gastable para siempre.
//
// La idempotencia se calcula por SALDO NETO, no por "¿ya hay una devolución?".
// Un pedido puede cancelarse, devolver, reabrirse —volviendo a gastar el
// saldo— y cancelarse otra vez. Preguntar si existe una devolución diría que
// sí y dejaría el segundo consumo sin devolver. El neto por lote no se
// equivoca: dice cuánto de este pedido sigue gastado, ahora mismo.

import type { Prisma } from "@/generated/prisma/client";
import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { aNumero, columnaSaldo } from "./money";

type Tx = Prisma.TransactionClient;

export type RefundResult = { refunded: number; lots: number; alreadyDone: boolean };

/** Cuánto sigue gastado de este pedido, lote por lote. */
async function pendienteDeDevolver(tx: Tx, orderId: string) {
  const movimientos = await tx.cashbackMovement.findMany({
    where: { orderId, type: { in: ["REDEEM", "ADJUST"] } },
  });

  const porLote = new Map<string | null, number>();
  let customerId: string | null = null;
  let currency: Currency | null = null;

  for (const m of movimientos) {
    customerId = m.customerId;
    currency = m.currency;
    // Los consumos son negativos y las devoluciones positivas: sumarlos deja
    // exactamente lo que falta por devolver de cada lote.
    const neto = (porLote.get(m.sourceMovementId) ?? 0) + aNumero(m.delta);
    porLote.set(m.sourceMovementId, neto);
  }

  const pendientes = [...porLote.entries()]
    .map(([loteId, neto]) => ({ loteId, importe: -neto }))
    .filter((p) => p.importe > 0);

  return { pendientes, customerId, currency };
}

/**
 * Devuelve al comprador el cashback que sigue gastado en este pedido.
 *
 * DEBE ejecutarse dentro de una transacción abierta.
 */
export async function refundOrderCashback(tx: Tx, orderId: string): Promise<RefundResult> {
  const { pendientes, customerId, currency } = await pendienteDeDevolver(tx, orderId);
  if (!customerId || !currency) return { refunded: 0, lots: 0, alreadyDone: false };
  if (pendientes.length === 0) return { refunded: 0, lots: 0, alreadyDone: true };

  // Bloqueo de la fila del cliente: aquí se serializa quien toque su saldo.
  await tx.$queryRawUnsafe(`SELECT id FROM customers WHERE id = $1 FOR UPDATE`, customerId);

  let devuelto = 0;
  let lotes = 0;

  for (const { loteId, importe } of pendientes) {
    if (loteId) {
      // Al lote del que salió. Su `expiresAt` NO se toca: el saldo tenía esa
      // fecha desde que nació y un pedido abandonado no la extiende. Si el
      // lote venció mientras tanto, el importe vuelve y queda vencido — que es
      // exactamente lo que habría pasado sin el pedido.
      await tx.cashbackMovement.update({
        where: { id: loteId },
        data: { remaining: { increment: importe } },
      });
      lotes += 1;
    }

    await tx.cashbackMovement.create({
      data: {
        customerId,
        delta: importe,
        currency,
        type: "ADJUST",
        orderId,
        sourceMovementId: loteId,
        note: "devolución: el pedido no se confirmó",
      },
    });
    devuelto += importe;
  }

  await tx.customer.update({
    where: { id: customerId },
    data: { [columnaSaldo(currency)]: { increment: devuelto } },
  });

  return { refunded: devuelto, lots: lotes, alreadyDone: false };
}

/** Abre su propia transacción. Para quien no tenga una en curso. */
export async function refundOrderCashbackStandalone(orderId: string): Promise<RefundResult> {
  return db.$transaction((tx) => refundOrderCashback(tx, orderId));
}

/** Cuánto de este pedido sigue gastado. Para decidir antes de reabrirlo. */
export async function outstandingCashback(tx: Tx, orderId: string): Promise<number> {
  const { pendientes } = await pendienteDeDevolver(tx, orderId);
  return pendientes.reduce((s, p) => s + p.importe, 0);
}
