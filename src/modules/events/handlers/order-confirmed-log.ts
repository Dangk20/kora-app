// Manejador de ejemplo para `order.confirmed`.
//
// Existe para dejar el contrato DEMOSTRADO antes de que llegue el manejador de
// Kora Cashback, que es el que va a acreditar dinero de verdad. Su único efecto
// es dejar rastro en el historial del pedido: comprobable, barato y sin
// consecuencias si se ejecuta de más.
//
// El patrón de idempotencia que usa es el que debe copiar el de cashback:
// ANTES de aplicar el efecto, comprobar si ya existe su rastro y no hacer nada
// si está. Ver openspec/changes/outbox-worker — specs/event-consumption.

import { db } from "@/lib/db";
import type { DomainEventRecord, EventHandler } from "../types";

const NOTA = "outbox: order.confirmed procesado";

type OrderConfirmedPayload = {
  orderId?: unknown;
  orderNumber?: unknown;
};

export const orderConfirmedLogHandler: EventHandler = {
  name: "order-confirmed-log",

  async handle(event: DomainEventRecord): Promise<void> {
    const payload = (event.payload ?? {}) as OrderConfirmedPayload;
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;

    if (!orderId) {
      // Un evento sin pedido es un error de quien lo emitió, no algo que
      // reintentar vaya a arreglar. Lanzar hace que agote intentos y quede
      // visible en el diagnóstico, que es donde debe verse.
      throw new Error(`order.confirmed sin orderId utilizable (evento ${event.id})`);
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new Error(`El pedido ${orderId} no existe (evento ${event.id})`);

    // ── Idempotencia ──
    // Si el rastro ya está, este evento ya se procesó: salir sin hacer nada.
    // La entrega es *al menos una vez*; sin esta comprobación, un reintento
    // tras una caída duplicaría el efecto.
    const yaProcesado = await db.orderStatusHistory.findFirst({
      where: { orderId, note: NOTA },
      select: { id: true },
    });
    if (yaProcesado) return;

    // `from` = `to`: no es una transición, es una anotación. El worker NUNCA
    // mueve el estado de un pedido — eso solo pasa por `canTransition()`.
    await db.orderStatusHistory.create({
      data: { orderId, from: order.status, to: order.status, note: NOTA },
    });
  },
};
