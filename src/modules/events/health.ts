// Diagnóstico de la bandeja de salida.
// Ver openspec/changes/outbox-worker — specs/event-observability.
//
// El worker corre fuera del ciclo de petición y respuesta: si se cae, ninguna
// pantalla se rompe y nadie se entera. Por eso esto no es un extra del change,
// es la mitad de su valor.

import { db } from "@/lib/db";
import { registeredTypes } from "./registry";
import { RETRY_POLICY } from "./types";

type Db = typeof db;

export type OutboxHealth = {
  counts: { pending: number; processing: number; processed: number; dead: number };
  /**
   * Antigüedad en segundos del evento pendiente más viejo. `null` si no hay.
   *
   * Es EL dato que importa: un número alto de pendientes es normal en una
   * ráfaga de confirmaciones, pero un evento pendiente desde hace horas
   * significa que la cola está atascada. Son situaciones opuestas que un
   * simple conteo no distingue.
   */
  oldestPendingAgeSeconds: number | null;
  dead: Array<{ id: string; type: string; attempts: number; lastError: string | null }>;
  /** Tipos presentes en la bandeja que ningún manejador atiende. */
  unhandledTypes: string[];
};

export async function outboxHealth(client: Db = db): Promise<OutboxHealth> {
  const [grouped, oldest, dead, typesInTable] = await Promise.all([
    client.domainEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    client.domainEvent.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    client.domainEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, attempts: true, lastError: true },
      take: 50,
    }),
    client.domainEvent.groupBy({ by: ["type"], where: { status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);

  const byStatus = (s: string) =>
    grouped.find((g) => g.status === s)?._count._all ?? 0;

  const atendidos = new Set(registeredTypes());

  return {
    counts: {
      pending: byStatus("PENDING"),
      processing: byStatus("PROCESSING"),
      processed: byStatus("PROCESSED"),
      dead: byStatus("FAILED"),
    },
    oldestPendingAgeSeconds: oldest
      ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000)
      : null,
    dead,
    unhandledTypes: typesInTable.map((t) => t.type).filter((t) => !atendidos.has(t)),
  };
}

/**
 * Devuelve un evento muerto a la cola, con el contador reiniciado.
 *
 * Deliberadamente manual: si los eventos muertos revivieran solos, el estado
 * terminal no significaría nada y el problema volvería en bucle. Reintentar es
 * una decisión de quien ya entendió y arregló la causa.
 */
export async function retryDeadEvent(eventId: string, client: Db = db): Promise<void> {
  const event = await client.domainEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error(`No existe el evento ${eventId}`);
  if (event.status !== "FAILED") {
    throw new Error(
      `El evento ${eventId} está en ${event.status}, no muerto. Solo se reintenta lo que agotó sus intentos.`,
    );
  }
  await client.domainEvent.update({
    where: { id: eventId },
    data: { status: "PENDING", attempts: 0, lastError: null, nextAttemptAt: new Date(), claimedAt: null },
  });
}

/** Reintenta todos los muertos de un tipo. Devuelve cuántos revivió. */
export async function retryAllDead(type?: string, client: Db = db): Promise<number> {
  const { count } = await client.domainEvent.updateMany({
    where: { status: "FAILED", ...(type ? { type } : {}) },
    data: { status: "PENDING", attempts: 0, lastError: null, nextAttemptAt: new Date(), claimedAt: null },
  });
  return count;
}

export { RETRY_POLICY };
