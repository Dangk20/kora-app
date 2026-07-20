// EL MOTOR DE INVENTARIO — plan técnico §2.1 y §2.2.
//
// Este módulo es EL ÚNICO CAMINO por el que stockActual puede cambiar.
// Toda mutación:
//   1. Bloquea la fila de la variante (SELECT ... FOR UPDATE) — serializa
//      a los competidores: web y POS compiten por la misma última unidad.
//   2. Inserta el movimiento en el libro contable (stock_movements).
//   3. Materializa stockActual dentro de LA MISMA transacción.
// El segundo en llegar espera el lock, relee el stock ya descontado y
// falla limpio con "agotado". Nunca hay stock negativo.

import type { Prisma, StockReason, SaleChannel } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export class StockError extends Error {
  constructor(
    public readonly code:
      | "INSUFFICIENT"
      | "INSUFFICIENT_ONLINE"
      | "VARIANT_NOT_FOUND",
    public readonly variantId: string,
    public readonly available?: number,
  ) {
    super(`${code}:${variantId}`);
    this.name = "StockError";
  }
}

type Tx = Prisma.TransactionClient;

export type MovementInput = {
  variantId: string;
  delta: number; // positivo entra, negativo sale
  reason: StockReason;
  channel: SaleChannel;
  actorId?: string;
  orderId?: string;
  note?: string;
};

/**
 * Núcleo transaccional. DEBE ejecutarse dentro de una transacción abierta.
 * Devuelve el stock resultante.
 */
export async function applyStockMovement(
  tx: Tx,
  input: MovementInput,
): Promise<number> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error(`Delta inválido: ${input.delta}`);
  }

  // Bloqueo de fila: aquí se decide quién gana la última unidad.
  const rows = await tx.$queryRaw<{ stockActual: number; onlineUnits: number }[]>`
    SELECT "stockActual", "onlineUnits" FROM variants WHERE id = ${input.variantId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new StockError("VARIANT_NOT_FOUND", input.variantId);
  }
  const current = rows[0].stockActual;
  const next = current + input.delta;
  if (next < 0) {
    throw new StockError("INSUFFICIENT", input.variantId, current);
  }

  // Asignación de canal sobre el mismo pool:
  // - La venta ONLINE consume su cupo (si no hay cupo, para la web está agotado
  //   aunque queden unidades en la tienda física).
  // - Cualquier otra salida (POS, merma…) NUNCA se bloquea por el cupo: si pisa
  //   unidades asignadas a online, el cupo se recorta (clamp) — al cajero no se
  //   le niega una venta con el producto en la mano.
  let nextOnline = rows[0].onlineUnits;
  if (input.reason === "VENTA_ONLINE" && input.delta < 0) {
    if (nextOnline + input.delta < 0) {
      throw new StockError("INSUFFICIENT_ONLINE", input.variantId, nextOnline);
    }
    nextOnline += input.delta;
  }
  nextOnline = Math.max(0, Math.min(nextOnline, next));

  await tx.stockMovement.create({
    data: {
      variantId: input.variantId,
      delta: input.delta,
      reason: input.reason,
      channel: input.channel,
      actorId: input.actorId,
      orderId: input.orderId,
      note: input.note,
    },
  });
  await tx.variant.update({
    where: { id: input.variantId },
    data: { stockActual: next, onlineUnits: nextOnline },
  });
  return next;
}

/**
 * Entrada de mercancía dentro de una transacción abierta (importador Excel,
 * compras futuras). Por defecto las unidades nuevas quedan publicadas online
 * — el mismo default que la creación de producto; la asignación se afina
 * después en Inventario.
 */
export async function receiveStock(
  tx: Tx,
  params: {
    variantId: string;
    qty: number;
    reason?: StockReason; // default COMPRA_INICIAL
    actorId?: string;
    note?: string;
    /** Si es false, el cupo online se queda como estaba (con clamp). */
    allOnline?: boolean;
  },
): Promise<number> {
  if (!Number.isInteger(params.qty) || params.qty <= 0) {
    throw new Error(`Cantidad inválida: ${params.qty}`);
  }
  const next = await applyStockMovement(tx, {
    variantId: params.variantId,
    delta: params.qty,
    reason: params.reason ?? "COMPRA_INICIAL",
    channel: "ADMIN",
    actorId: params.actorId,
    note: params.note,
  });
  if (params.allOnline !== false) {
    await tx.variant.update({
      where: { id: params.variantId },
      data: { onlineUnits: next },
    });
  }
  return next;
}

/**
 * Venta multi-ítem atómica (web o POS): o se descuenta todo, o nada.
 * Los ítems se bloquean en orden estable (variantId) para evitar deadlocks
 * entre ventas concurrentes con ítems cruzados.
 */
export async function sellStock(params: {
  items: { variantId: string; qty: number }[];
  channel: SaleChannel;
  reason: StockReason; // VENTA_ONLINE | VENTA_POS
  orderId?: string;
  actorId?: string;
}): Promise<void> {
  const sorted = [...params.items].sort((a, b) =>
    a.variantId.localeCompare(b.variantId),
  );
  await db.$transaction(
    async (tx) => {
      for (const item of sorted) {
        if (item.qty <= 0) throw new Error(`Cantidad inválida: ${item.qty}`);
        await applyStockMovement(tx, {
          variantId: item.variantId,
          delta: -item.qty,
          reason: params.reason,
          channel: params.channel,
          orderId: params.orderId,
          actorId: params.actorId,
        });
      }
    },
    // Bajo contención (N ventas esperando el mismo lock) la espera es normal:
    // no abortar por el timeout por defecto de 5s.
    { timeout: 30_000, maxWait: 30_000 },
  );
}

/**
 * Ajuste manual desde el panel: fija el stock en un valor objetivo.
 * El delta se calcula DESPUÉS de tomar el lock (no confía en lo que veía la UI).
 */
export async function setStockTo(params: {
  variantId: string;
  target: number;
  /** Unidades publicadas online. Si se omite, se conserva (con clamp al total). */
  onlineTarget?: number;
  reason: StockReason; // AJUSTE_MANUAL | MERMA | DEVOLUCION | COMPRA_INICIAL
  actorId: string;
  note?: string;
}): Promise<{ from: number; to: number; online: number }> {
  if (!Number.isInteger(params.target) || params.target < 0) {
    throw new Error(`Stock objetivo inválido: ${params.target}`);
  }
  if (
    params.onlineTarget !== undefined &&
    (!Number.isInteger(params.onlineTarget) ||
      params.onlineTarget < 0 ||
      params.onlineTarget > params.target)
  ) {
    throw new Error(
      `Unidades online inválidas: ${params.onlineTarget} (deben estar entre 0 y ${params.target})`,
    );
  }
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ stockActual: number; onlineUnits: number }[]>`
        SELECT "stockActual", "onlineUnits" FROM variants WHERE id = ${params.variantId} FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new StockError("VARIANT_NOT_FOUND", params.variantId);
      }
      const current = rows[0].stockActual;
      const online = Math.max(
        0,
        Math.min(params.onlineTarget ?? rows[0].onlineUnits, params.target),
      );

      if (current !== params.target) {
        await tx.stockMovement.create({
          data: {
            variantId: params.variantId,
            delta: params.target - current,
            reason: params.reason,
            channel: "ADMIN",
            actorId: params.actorId,
            note: params.note,
          },
        });
      }
      await tx.variant.update({
        where: { id: params.variantId },
        data: { stockActual: params.target, onlineUnits: online },
      });
      return { from: current, to: params.target, online };
    },
    { timeout: 30_000, maxWait: 30_000 },
  );
}

/**
 * Verificación del libro contable: toda variante cuyo stock materializado
 * no cuadre con la suma de sus movimientos. Corre como job nocturno y en CI.
 */
export async function findLedgerMismatches(): Promise<
  { sku: string; stockActual: number; ledgerSum: number }[]
> {
  return db.$queryRaw`
    SELECT v.sku,
           v."stockActual" AS "stockActual",
           COALESCE(SUM(m.delta), 0)::int AS "ledgerSum"
    FROM variants v
    LEFT JOIN stock_movements m ON m."variantId" = v.id
    GROUP BY v.id, v.sku, v."stockActual"
    HAVING v."stockActual" <> COALESCE(SUM(m.delta), 0)
  `;
}
