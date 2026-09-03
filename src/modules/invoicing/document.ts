// EMISIÓN DEL COMPROBANTE DE PEDIDO.
// Ver openspec/changes/comprobante-de-pedido — specs/sales-document.
//
// Un pedido confirmado emite EXACTAMENTE UN comprobante, y lo emite dentro de
// la misma transacción que lo confirma. Fuera de ella habría una ventana con un
// comprobante de un pedido que todavía podría no confirmarse; y, peor, un
// pedido confirmado podría quedarse sin comprobante SIN DAR NINGÚN ERROR —
// eso se descubre el día que alguien lo pide.
//
// La unicidad la garantiza el índice único de `orderId`, no una lectura previa:
// leer no es reservar, y dos procesos pueden mirar a la vez y ver ambos que no
// está.

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CONFIRMED_STATUSES } from "@/modules/customers/confirmed";
import {
  buildSnapshot,
  SELECT_PARA_COMPROBANTE,
  type SalesDocumentSnapshot,
} from "./snapshot";

type Tx = Prisma.TransactionClient;

export type SalesDocument = {
  id: string;
  orderId: string;
  number: number;
  issuedAt: Date;
  snapshot: SalesDocumentSnapshot;
};

/**
 * Congela el comprobante de un pedido que se está confirmando.
 *
 * ⚠️ TIENE que llamarse dentro de la MISMA transacción que escribe
 * `status: "CONFIRMED"`. Hay una prueba que lee el código fuente y lo comprueba
 * (`tests/comprobante.test.ts`): hoy `confirmOrder()` es el único camino, pero
 * el POS (S9) abrirá otro y no puede olvidarse de esto.
 *
 * Idempotente: confirmar dos veces no emite dos comprobantes.
 */
export async function freezeSalesDocument(
  tx: Tx,
  orderId: string,
  issuedAt: Date,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: SELECT_PARA_COMPROBANTE,
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const snapshot = buildSnapshot(order, issuedAt);

  try {
    await tx.salesDocument.create({
      data: {
        orderId,
        number: order.number,
        issuedAt,
        currency: order.currency,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // Ya existía: es una segunda confirmación del mismo pedido. El comprobante
    // bueno es el PRIMERO, con su fecha original — no se pisa.
    if (!esDuplicado(e)) throw e;
  }
}

function esDuplicado(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}

/**
 * El comprobante de un pedido, emitiéndolo si falta.
 *
 * Los pedidos confirmados ANTES de que existiera este módulo no tienen
 * comprobante. No se rellenaron hacia atrás en el despliegue a propósito:
 * generarlos en masa escribiría documentos que nadie pidió, con los datos del
 * comerciante de hoy. En su lugar se emiten al vuelo cuando alguien los
 * necesita, fechados con la confirmación REAL del pedido —no con el momento en
 * que se pidieron—, que es lo que el documento tiene que decir.
 *
 * Devuelve `null` si el pedido no está confirmado: un pedido pendiente,
 * cancelado o expirado no vendió nada, y un comprobante de una venta que no
 * ocurrió es exactamente lo que no puede existir.
 */
export async function ensureSalesDocument(orderId: string): Promise<SalesDocument | null> {
  const existente = await leer(orderId);
  if (existente) return existente;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, confirmedAt: true },
  });
  // "Llegó a confirmarse" tiene UNA definición en el proyecto y es esta: un
  // pedido entregado sigue siendo una venta; uno cancelado dejó de serlo.
  // Escribir aquí un filtro propio es como acabarían discrepando el listado de
  // ventas y los comprobantes emitidos, sin que ninguno de los dos pareciera mal.
  if (!order || !CONFIRMED_STATUSES.includes(order.status)) return null;
  if (!order.confirmedAt) return null;

  await db.$transaction((tx) => freezeSalesDocument(tx, orderId, order.confirmedAt!));
  return leer(orderId);
}

async function leer(orderId: string): Promise<SalesDocument | null> {
  const fila = await db.salesDocument.findUnique({
    where: { orderId },
    select: { id: true, orderId: true, number: true, issuedAt: true, snapshot: true },
  });
  if (!fila) return null;
  return { ...fila, snapshot: fila.snapshot as unknown as SalesDocumentSnapshot };
}
