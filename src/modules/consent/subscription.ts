// Estado de suscripción del cliente, con su registro auditable.
// Ver openspec/changes/email-marketing — specs/email-consent.
//
// Un booleano no responde "¿con qué autorización le escribieron?", que es la
// pregunta que llega en un requerimiento sobre datos personales. Cada cambio
// deja su fila con fecha y origen, y nunca se sobrescribe en silencio.

import type { ConsentSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type SubscriptionState = {
  subscribed: boolean;
  emailUsable: boolean;
  /** true solo si además tiene correo: es lo que decide si puede recibir. */
  reachable: boolean;
  since: Date | null;
  source: ConsentSource | null;
};

/** Los clientes que hoy pueden recibir una campaña. Para el card del panel. */
export async function subscriberCount(): Promise<number> {
  return db.customer.count({
    where: { acceptsMarketing: true, emailUsable: true, email: { not: null } },
  });
}

export async function subscriptionState(customerId: string): Promise<SubscriptionState> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      acceptsMarketing: true,
      emailUsable: true,
      email: true,
      consentEvents: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) {
    return { subscribed: false, emailUsable: false, reachable: false, since: null, source: null };
  }
  const ultimo = c.consentEvents[0];
  return {
    subscribed: c.acceptsMarketing,
    emailUsable: c.emailUsable,
    reachable: c.acceptsMarketing && c.emailUsable && Boolean(c.email),
    since: ultimo?.createdAt ?? null,
    source: ultimo?.source ?? null,
  };
}

/** Historial completo, del más reciente al más antiguo. */
export async function consentHistory(customerId: string, limit = 20) {
  return db.consentEvent.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Cambia el estado dejando constancia. El estado y su registro se escriben en
 * la MISMA transacción: un estado sin su motivo no sirve como prueba.
 *
 * Idempotente: si ya está en ese estado por la misma vía, no duplica el
 * registro. Un aviso de rebote que llegue dos veces no debe verse como dos
 * hechos distintos.
 */
export async function setSubscription(args: {
  customerId: string;
  subscribed: boolean;
  source: ConsentSource;
  note?: string;
}): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const actual = await tx.customer.findUnique({
      where: { id: args.customerId },
      select: { acceptsMarketing: true, unsubscribedAt: true },
    });
    if (!actual) return { changed: false };

    if (actual.acceptsMarketing === args.subscribed) {
      const yaRegistrado = await tx.consentEvent.findFirst({
        where: { customerId: args.customerId, subscribed: args.subscribed, source: args.source },
        select: { id: true },
      });
      if (yaRegistrado) return { changed: false };
    }

    await tx.customer.update({
      where: { id: args.customerId },
      data: {
        acceptsMarketing: args.subscribed,
        // La fecha de baja se conserva aunque vuelva a suscribirse: es parte
        // de la historia, no un interruptor.
        unsubscribedAt: args.subscribed ? actual.unsubscribedAt : new Date(),
      },
    });
    await tx.consentEvent.create({
      data: {
        customerId: args.customerId,
        subscribed: args.subscribed,
        source: args.source,
        note: args.note ?? null,
      },
    });
    return { changed: true };
  });
}

/**
 * Suscribe al comprar.
 *
 * ⚠️ NO re-suscribe a quien se dio de baja. Si una compra reactivara la
 * suscripción, la baja no significaría nada y quien se dio de baja volvería a
 * recibir correo — que es exactamente lo que la ley prohíbe. La reactivación
 * solo la puede pedir el propio cliente.
 */
export async function subscribeFromCheckout(
  customerId: string,
  accepted: boolean,
): Promise<void> {
  if (!accepted) return;

  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: { unsubscribedAt: true, acceptsMarketing: true },
  });
  if (!c) return;
  if (c.unsubscribedAt && !c.acceptsMarketing) return; // dado de baja: se respeta

  await setSubscription({
    customerId,
    subscribed: true,
    source: "CHECKOUT",
    note: "aceptó al hacer un pedido",
  });
}

/** Baja desde el enlace del correo. Un clic, efecto inmediato. */
export async function unsubscribeByLink(customerId: string): Promise<{ changed: boolean }> {
  return setSubscription({
    customerId,
    subscribed: false,
    source: "UNSUBSCRIBE_LINK",
    note: "enlace de baja del correo",
  });
}

/** Reactivación: SOLO por decisión del propio cliente, desde la página de baja. */
export async function resubscribe(customerId: string): Promise<{ changed: boolean }> {
  return setSubscription({
    customerId,
    subscribed: true,
    source: "RESUBSCRIBE",
    note: "el cliente volvió a suscribirse",
  });
}
