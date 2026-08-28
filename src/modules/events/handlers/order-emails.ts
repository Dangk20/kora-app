// Los correos del pedido, colgados de la bandeja de salida.
// Ver openspec/changes/correos-transaccionales — specs/transactional-email.
//
// Cuelgan de eventos y no de la acción a propósito: enviar dentro de
// `createOrder()` ataría la venta a que un tercero responda. Un proveedor lento
// convertiría el checkout en una espera y uno caído, en un error — y perder la
// venta porque no salió el correo es cambiar un problema pequeño por el peor
// de todos.
//
// La idempotencia NO está aquí: está en `sendOrderEmail`, que reserva antes de
// entregar. Estos manejadores pueden ejecutarse dos veces sin consecuencias.

import type { OrderEmailType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { orderEmailContext } from "@/modules/notifications/order-data";
import { renderOrderEmail } from "@/modules/notifications/render";
import { sendOrderEmail } from "@/modules/notifications/send";
import { orderNoticeRecipients } from "@/modules/notifications/settings";
import type { DomainEventRecord, EventHandler } from "../types";

function orderIdDe(event: DomainEventRecord): string {
  const payload = (event.payload ?? {}) as { orderId?: unknown };
  if (typeof payload.orderId !== "string") {
    // Un evento sin pedido es un error de quien lo emitió; reintentar no lo
    // arregla. Lanzar lo hace visible en el diagnóstico, que es donde debe verse.
    throw new Error(`${event.type} sin orderId utilizable (evento ${event.id})`);
  }
  return payload.orderId;
}

/** Deja constancia de por qué NO se envió, en vez de callar. */
async function anotar(orderId: string, nota: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return;
  const ya = await db.orderStatusHistory.findFirst({
    where: { orderId, note: nota },
    select: { id: true },
  });
  if (ya) return;
  await db.orderStatusHistory.create({
    data: { orderId, from: order.status, to: order.status, note: nota },
  });
}

/** Envía un correo al COMPRADOR. Falla ruidosamente si el proveedor falla. */
async function alComprador(
  event: DomainEventRecord,
  type: OrderEmailType,
  extra?: { cancelReason?: "EXPIRED" | "CANCELLED" },
): Promise<void> {
  const orderId = orderIdDe(event);
  const ctx = await orderEmailContext(orderId);
  if (!ctx) throw new Error(`El pedido ${orderId} no existe (evento ${event.id})`);

  const email = renderOrderEmail(type, { ...ctx, ...extra });
  const r = await sendOrderEmail({
    orderId,
    type,
    to: ctx.buyerEmail,
    toName: ctx.buyerName,
    email,
  });

  if (r.sent || r.reason === "YA_ENVIADO") return;

  if (r.reason === "NO_ENVIABLE") {
    // No hay correo, o la dirección rebotó. No es un fallo del sistema: no
    // tiene sentido reintentarlo, pero sí dejarlo escrito.
    await anotar(orderId, `correo (${type}): no enviado — ${r.detail}`);
    return;
  }

  // El proveedor falló: se lanza para que la bandeja reintente. Al volver, la
  // reserva ya existe y el correo no se duplica.
  throw new Error(`No se pudo enviar ${type} del pedido ${orderId}: ${r.detail}`);
}

export const orderCreatedBuyerEmail: EventHandler = {
  name: "order-created-buyer-email",
  handle: (event) => alComprador(event, "BUYER_CREATED"),
};

export const orderConfirmedBuyerEmail: EventHandler = {
  name: "order-confirmed-buyer-email",
  handle: (event) => alComprador(event, "BUYER_CONFIRMED"),
};

export const orderPreparingBuyerEmail: EventHandler = {
  name: "order-preparing-buyer-email",
  handle: (event) => alComprador(event, "BUYER_PREPARING"),
};

export const orderShippedBuyerEmail: EventHandler = {
  name: "order-shipped-buyer-email",
  handle: (event) => alComprador(event, "BUYER_SHIPPED"),
};

export const orderDeliveredBuyerEmail: EventHandler = {
  name: "order-delivered-buyer-email",
  handle: (event) => alComprador(event, "BUYER_DELIVERED"),
};

export const orderCancelledBuyerEmail: EventHandler = {
  name: "order-cancelled-buyer-email",
  async handle(event) {
    const payload = (event.payload ?? {}) as { reason?: unknown };
    const expirado = payload.reason === "EXPIRED";
    await alComprador(event, "BUYER_CANCELLED", {
      cancelReason: expirado ? "EXPIRED" : "CANCELLED",
    });
  },
};

/**
 * Aviso al operador de que entró un pedido.
 *
 * Un pedido pendiente vive 2 horas: si nadie lo ve, la venta se cae sola. Este
 * correo es lo que convierte el pedido en una llamada.
 */
export const orderCreatedStaffEmail: EventHandler = {
  name: "order-created-staff-email",
  async handle(event) {
    const orderId = orderIdDe(event);
    const destinos = await orderNoticeRecipients();

    if (destinos.length === 0) {
      // Sin nadie a quien avisar no se falla —el pedido no tiene la culpa— pero
      // SÍ queda escrito: un negocio que no recibe avisos tiene que poder
      // enterarse de que no los recibe.
      await anotar(orderId, "correo (STAFF_NEW_ORDER): no enviado — no hay ningún destinatario configurado");
      return;
    }

    const ctx = await orderEmailContext(orderId);
    if (!ctx) throw new Error(`El pedido ${orderId} no existe (evento ${event.id})`);
    const email = renderOrderEmail("STAFF_NEW_ORDER", ctx);

    // Se recorren TODOS antes de decidir si el manejador falla. Cortar en el
    // primer error dejaría sin aviso a los que vienen después por culpa de una
    // dirección ajena, y el reintento volvería a empezar por el mismo sitio.
    // Cada destinatario tiene su propia reserva, así que quien ya recibió no
    // recibe de nuevo al reintentar.
    const fallos: string[] = [];

    for (const to of destinos) {
      const r = await sendOrderEmail({
        orderId,
        type: "STAFF_NEW_ORDER",
        to,
        email,
        // Las direcciones del negocio no pasan por la lista de supresión de los
        // compradores: son internas y no se les puede dar de baja.
        skipGuard: true,
      });

      if (r.sent || r.reason === "YA_ENVIADO") continue;

      if (r.reason === "NO_ENVIABLE") {
        // Una dirección inservible es un dato del negocio, no un fallo del
        // sistema: se anota y no se reintenta, porque reintentar no la arregla.
        await anotar(orderId, `correo (STAFF_NEW_ORDER → ${to}): no enviado — ${r.detail}`);
        continue;
      }

      fallos.push(`${to}: ${r.detail}`);
    }

    // Basta con que UNO haya fallado por el proveedor para reintentar el
    // evento: los que ya salieron están reservados y no se repetirán.
    if (fallos.length > 0) {
      throw new Error(
        `No se pudo avisar del pedido ${orderId} a ${fallos.length} de ${destinos.length} destinatarios — ${fallos.join(" · ")}`,
      );
    }
  },
};
