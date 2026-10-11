// La compra confirmada, informada a Meta (API de Conversiones) y a GA4
// (Measurement Protocol). Ver openspec/changes/medicion-publicitaria.
//
// Cuelga de `order.confirmed` porque en KORA es el ÚNICO momento en que existe
// una venta: el pago ocurre por WhatsApp y el navegador del comprador nunca la
// ve. Un píxel en la página de gracias contaría pedidos creados, incluidos los
// que vencen sin pagar.
//
// Idempotencia: `ad_conversions` (único por pedido y plataforma) se consulta
// antes y se escribe DESPUÉS de enviar. Si el proceso muere entre medias y el
// evento se reintenta, la compra sale dos veces y la plataforma la deduplica
// (Meta por `event_id`, GA4 por `transaction_id`). Reservar antes, como hace el
// correo, cambiaría ese duplicado inofensivo por una venta que nunca se informa.

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { storeUrl } from "@/lib/site";
import { readMeasurementConfig } from "@/modules/measurement/config";
import {
  buildGa4Purchase,
  buildMetaPurchase,
  metaEventId,
  sendGa4,
  sendMetaEvents,
  type ConfirmedOrder,
} from "@/modules/measurement/purchase";
import { formatOrderNumber } from "@/modules/orders/message";
import type { DomainEventRecord, EventHandler } from "../types";

type Plataforma = "META" | "GA4";

function orderIdDe(event: DomainEventRecord): string {
  const payload = (event.payload ?? {}) as { orderId?: unknown };
  if (typeof payload.orderId !== "string") {
    throw new Error(`order.confirmed sin orderId utilizable (evento ${event.id})`);
  }
  return payload.orderId;
}

/**
 * El pedido listo para informar, o `null` si NO se debe informar: venta de
 * mostrador, sin atribución o sin consentimiento. No es un error: es la regla.
 */
export async function pedidoInformable(orderId: string): Promise<ConfirmedOrder | null> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, attribution: true },
  });
  if (!o) throw new Error(`El pedido ${orderId} no existe`);
  if (o.channel !== "WEB" || !o.attribution?.consent) return null;

  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    confirmedAt: o.confirmedAt,
    currency: o.currency,
    total: Number(o.total),
    customerId: o.customerId,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    billCity: o.billCity,
    billState: o.billState,
    billCountry: o.billCountry,
    billZip: o.billZip,
    items: o.items.map((i) => ({
      sku: i.sku,
      productName: i.productName,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
    })),
    attribution: {
      fbp: o.attribution.fbp,
      fbc: o.attribution.fbc,
      gaClientId: o.attribution.gaClientId,
      gaSessionId: o.attribution.gaSessionId,
      userAgent: o.attribution.userAgent,
      ipAddress: o.attribution.ipAddress,
    },
  };
}

async function yaInformado(orderId: string, platform: Plataforma): Promise<boolean> {
  const fila = await db.adConversion.findUnique({
    where: { orderId_platform: { orderId, platform } },
    select: { id: true },
  });
  return Boolean(fila);
}

async function registrar(order: ConfirmedOrder, platform: Plataforma, eventId: string): Promise<void> {
  try {
    await db.adConversion.create({
      data: { orderId: order.id, platform, eventId, value: order.total, currency: order.currency },
    });
  } catch (e) {
    // Otro trabajador lo registró a la vez: la constancia ya existe.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

export const orderConfirmedMetaHandler: EventHandler = {
  name: "order-confirmed-meta-capi",

  async handle(event: DomainEventRecord): Promise<void> {
    const config = readMeasurementConfig().meta;
    if (!config) return;
    const orderId = orderIdDe(event);
    if (await yaInformado(orderId, "META")) return;

    const order = await pedidoInformable(orderId);
    if (!order) return;

    await sendMetaEvents(config, [buildMetaPurchase(order, `${storeUrl()}/checkout`)]);
    await registrar(order, "META", metaEventId(order.id));
  },
};

export const orderConfirmedGa4Handler: EventHandler = {
  name: "order-confirmed-ga4",

  async handle(event: DomainEventRecord): Promise<void> {
    const config = readMeasurementConfig().ga4;
    if (!config) return;
    const orderId = orderIdDe(event);
    if (await yaInformado(orderId, "GA4")) return;

    const order = await pedidoInformable(orderId);
    if (!order) return;

    await sendGa4(config, buildGa4Purchase(order));
    await registrar(order, "GA4", formatOrderNumber(order.number, order.createdAt));
  },
};
