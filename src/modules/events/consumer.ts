// Motor de consumo de la bandeja de salida.
// Ver openspec/changes/outbox-worker — specs/event-consumption.
//
// Toma eventos pendientes, los entrega a sus manejadores y marca el resultado.
// La garantía que sostiene todo lo demás: un evento escrito en la bandeja ya
// ocurrió en el negocio (el pedido se confirmó, el stock se descontó), así que
// tiene que terminar procesado o visiblemente muerto — nunca a medias.

import { db } from "@/lib/db";
import { handlersFor } from "./registry";
import {
  backoffMs,
  ORPHAN_TIMEOUT_MS,
  RETRY_POLICY,
  type DomainEventRecord,
  type ProcessOutcome,
} from "./types";

type Db = typeof db;

/** Cuántos eventos se toman por ciclo. Acota el drenaje inicial. */
export const DEFAULT_BATCH_SIZE = 20;

type ClaimedRow = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
};

/**
 * Toma hasta `limit` eventos y los marca como en proceso, de forma exclusiva.
 *
 * `FOR UPDATE SKIP LOCKED` es lo que impide que dos trabajadores tomen el mismo
 * evento, y lo que permite que un trabajador lento no bloquee al otro: el
 * segundo salta las filas ya tomadas en vez de esperarlas.
 *
 * Va en SQL directo porque Prisma no expone SKIP LOCKED. No es un atajo: la
 * exclusión tiene que ser una propiedad de la base, no la suposición de que en
 * la práctica solo corre un worker — el precio de romperla es acreditar dinero
 * dos veces.
 */
export async function claimBatch(
  client: Db = db,
  limit = DEFAULT_BATCH_SIZE,
): Promise<DomainEventRecord[]> {
  const rows = await client.$queryRaw<ClaimedRow[]>`
    WITH elegibles AS (
      SELECT id
      FROM domain_events
      WHERE status = 'PENDING'
        AND "nextAttemptAt" <= NOW()
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE domain_events e
    SET status = 'PROCESSING', "claimedAt" = NOW()
    FROM elegibles
    WHERE e.id = elegibles.id
    RETURNING e.id, e.type, e.payload, e.attempts, e."createdAt"
  `;
  return rows;
}

/**
 * Devuelve a la cola los eventos que se quedaron en proceso: su trabajador
 * murió sin dejarlos en estado terminal. Sin esto se quedarían ahí para
 * siempre, y nadie sabría si están en curso o abandonados.
 */
export async function recoverOrphans(
  client: Db = db,
  timeoutMs = ORPHAN_TIMEOUT_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMs);
  const { count } = await client.domainEvent.updateMany({
    where: { status: "PROCESSING", claimedAt: { lt: cutoff } },
    data: { status: "PENDING", claimedAt: null },
  });
  return count;
}

/**
 * Ejecuta los manejadores de un evento ya tomado y marca su resultado.
 *
 * El estado es del EVENTO, no de la pareja evento–manejador: se marca como
 * procesado solo si TODOS sus manejadores tuvieron éxito, y si alguno falla se
 * reintenta el evento completo. Con manejadores idempotentes, reejecutar los
 * que ya funcionaron no tiene efecto (design.md §4).
 */
export async function processEvent(
  event: DomainEventRecord,
  client: Db = db,
): Promise<ProcessOutcome> {
  const handlers = handlersFor(event.type);

  // Sin manejador no se marca procesado (mentiría) ni se reintenta en bucle:
  // se aparta con una espera larga y queda visible en el diagnóstico.
  if (handlers.length === 0) {
    await client.domainEvent.update({
      where: { id: event.id },
      data: {
        status: "PENDING",
        claimedAt: null,
        nextAttemptAt: new Date(Date.now() + RETRY_POLICY.maxDelayMs),
        lastError: `Sin manejador registrado para "${event.type}"`,
      },
    });
    return { event: event.id, result: "unhandled" };
  }

  try {
    for (const handler of handlers) {
      await handler.handle(event);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = event.attempts + 1;

    // Agotados los intentos, el evento MUERE: terminal y visible. Un evento
    // muerto es una tarea de negocio que no ocurrió; sin el motivo, la única
    // salida sería reproducir el fallo a ciegas.
    if (attempts >= RETRY_POLICY.maxAttempts) {
      await client.domainEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", claimedAt: null, attempts, lastError: message },
      });
      return { event: event.id, result: "dead", attempts, error: message };
    }

    await client.domainEvent.update({
      where: { id: event.id },
      data: {
        status: "PENDING",
        claimedAt: null,
        attempts,
        lastError: message,
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      },
    });
    return { event: event.id, result: "retry", attempts, error: message };
  }

  await client.domainEvent.update({
    where: { id: event.id },
    data: {
      status: "PROCESSED",
      claimedAt: null,
      processedAt: new Date(),
      lastError: null,
    },
  });
  return { event: event.id, result: "processed", handlers: handlers.length };
}

/** Un ciclo completo: recupera huérfanos, toma un lote y lo procesa. */
export async function runOnce(
  client: Db = db,
  limit = DEFAULT_BATCH_SIZE,
): Promise<ProcessOutcome[]> {
  await recoverOrphans(client);
  const batch = await claimBatch(client, limit);
  const outcomes: ProcessOutcome[] = [];
  for (const event of batch) {
    outcomes.push(await processEvent(event, client));
  }
  return outcomes;
}
