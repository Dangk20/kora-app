// Contrato de los manejadores de eventos de dominio.
// Ver openspec/changes/outbox-worker — specs/event-consumption.

import type { EventStatus } from "@/generated/prisma/enums";

/** Un evento tal como lo recibe un manejador. */
export type DomainEventRecord = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
};

/**
 * Un manejador de eventos.
 *
 * ⚠️ TODO MANEJADOR DEBE SER IDEMPOTENTE. No es una recomendación de estilo:
 * la entrega es *al menos una vez*. Un evento puede llegar dos veces porque el
 * proceso murió justo después de aplicar el efecto y antes de marcarlo como
 * procesado, o porque otro manejador del mismo evento falló y se reintentó el
 * evento completo.
 *
 * El primer consumidor real de esta cola acredita dinero al cliente. Un
 * manejador no idempotente convierte un reintento tras un corte de red en un
 * saldo regalado. La propiedad está fijada por prueba automatizada.
 *
 * Forma habitual de conseguirlo: antes de aplicar el efecto, comprobar si ya
 * existe su rastro (por ejemplo, un movimiento ligado a ese pedido) y no hacer
 * nada si está.
 *
 * Si lanza, el evento se considera fallido: vuelve a la cola con el contador
 * aumentado hasta agotar sus intentos.
 */
export type EventHandler = {
  /** Identifica al manejador en registros y diagnósticos. */
  readonly name: string;
  handle(event: DomainEventRecord): Promise<void>;
};

/** Resultado de procesar un evento, para registros y pruebas. */
export type ProcessOutcome =
  | { event: string; result: "processed"; handlers: number }
  | { event: string; result: "retry"; attempts: number; error: string }
  | { event: string; result: "dead"; attempts: number; error: string }
  | { event: string; result: "unhandled" };

export type { EventStatus };

/**
 * Política de reintentos.
 *
 * La espera crece con cada intento para que un fallo pasajero se recupere en
 * segundos y una dependencia caída no genere carga sostenida. Con estos valores
 * un evento vive unos minutos antes de morir: suficiente para un reinicio de
 * base de datos, no tanto como para que un problema real pase inadvertido.
 */
export const RETRY_POLICY = {
  maxAttempts: 5,
  baseDelayMs: 5_000,
  maxDelayMs: 5 * 60_000,
} as const;

/** Espera antes del siguiente intento, creciente y acotada. */
export function backoffMs(attempts: number, policy = RETRY_POLICY): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(0, attempts - 1);
  return Math.min(exponential, policy.maxDelayMs);
}

/**
 * Cuánto puede estar un evento en PROCESSING antes de considerarlo huérfano de
 * un proceso muerto. Debe superar con margen la duración del manejador más
 * lento: si se queda corto, se reprocesaría trabajo que aún está en curso —y
 * solo la idempotencia evitaría el daño—.
 */
export const ORPHAN_TIMEOUT_MS = 5 * 60_000;
