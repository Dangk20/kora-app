// Enviar un correo del pedido, exactamente una vez.
// Ver openspec/changes/correos-transaccionales — specs/transactional-email.
//
// ⚠️ SE RESERVA ANTES DE ENVIAR, y el orden importa.
//
// Si se enviara primero y se registrara después, un fallo entre medias haría
// que el reintento VOLVIERA A ENVIAR. Reservando antes, el peor caso es que
// alguien no reciba un correo —molesto— en vez de recibirlo dos veces, que es
// lo que hace que un comprador dude de si compró dos veces y que un operador
// deje de mirar los avisos.
//
// La garantía la da el índice único (pedido, tipo, DESTINATARIO), no la
// comprobación previa: dos trabajadores pueden mirar a la vez y ver ambos que
// no está. Leer no es reservar.
//
// El destinatario entra en la clave desde el 28 ago 2026, cuando el aviso de
// pedido nuevo pasó a ir a varias personas. Sin él, el segundo destinatario
// chocaba contra la reserva del primero y se quedaba sin correo.

import type { OrderEmailType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { emailDriver } from "@/modules/email";
import { canSendTransactional } from "./guard";
import type { RenderedEmail } from "./render";

export type SendOutcome =
  | { sent: true; providerId: string }
  | { sent: false; reason: "YA_ENVIADO" | "NO_ENVIABLE" | "FALLO_PROVEEDOR"; detail: string };

/** Cuánto puede estar un envío "en curso" antes de darlo por muerto. */
const INTENTO_MUERTO_MS = 5 * 60_000;

type Reserva = { id: string } | null;

/**
 * Toma el envío para este proceso. `null` si ya salió o si otro lo está haciendo.
 *
 * Dos pasos, y ninguno sobra:
 *
 *   1. Insertar. El índice único hace que solo uno gane la carrera; el resto
 *      choca. Leer antes y escribir después NO serviría: dos procesos pueden
 *      leer a la vez y ver ambos que no está.
 *
 *   2. Si chocó, es que la fila ya existe — pero puede ser de un intento que
 *      falló. Se toma con una ESCRITURA CONDICIONAL: solo la gana quien
 *      consiga poner su marca sobre una fila sin enviar y sin dueño reciente.
 *      Sin esto, un fallo del proveedor dejaría el correo sin salir nunca.
 */
async function tomar(
  orderId: string,
  type: OrderEmailType,
  to: string,
): Promise<Reserva> {
  try {
    const fila = await db.orderEmail.create({
      data: { orderId, type, to, claimedAt: new Date(), attempts: 1 },
      select: { id: true },
    });
    return fila;
  } catch (e) {
    if (!esDuplicado(e)) throw e;
  }

  const limite = new Date(Date.now() - INTENTO_MUERTO_MS);
  const tomados = await db.orderEmail.updateMany({
    where: {
      orderId,
      type,
      // El destinatario acota la fila: cada uno tiene la suya, con sus propios
      // intentos y su propio error. Un correo que rebota no bloquea a nadie más.
      to,
      // Ya enviado: no se toca. Es lo que impide el duplicado.
      sentAt: null,
      OR: [{ claimedAt: null }, { claimedAt: { lt: limite } }],
    },
    // `to` ya NO se actualiza: forma parte de la clave, así que cambiarlo aquí
    // convertiría la fila en la de otra persona.
    data: { claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (tomados.count === 0) return null;

  const fila = await db.orderEmail.findUnique({
    where: { orderId_type_to: { orderId, type, to } },
    select: { id: true },
  });
  return fila;
}

function esDuplicado(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}

export type SendArgs = {
  orderId: string;
  type: OrderEmailType;
  /** A dónde va. Para el comprador, el del PEDIDO — no el de su ficha. */
  to: string | null;
  toName?: string | null;
  email: RenderedEmail;
  /** Un aviso al operador no pasa por la lista de supresión del comprador. */
  skipGuard?: boolean;
};

export async function sendOrderEmail(args: SendArgs): Promise<SendOutcome> {
  // ¿Se le puede escribir? La baja de marketing NO cuenta aquí: esto es un
  // comprobante, no publicidad.
  const permiso = args.skipGuard
    ? args.to
      ? ({ ok: true, to: args.to.trim().toLowerCase() } as const)
      : ({ ok: false, reason: "SIN_CORREO", detail: "no hay dirección" } as const)
    : await canSendTransactional(args.to);

  if (!permiso.ok) {
    return { sent: false, reason: "NO_ENVIABLE", detail: permiso.detail };
  }

  const reserva = await tomar(args.orderId, args.type, permiso.to);
  if (!reserva) {
    return {
      sent: false,
      reason: "YA_ENVIADO",
      detail: "este correo ya salió, o hay otro proceso enviándolo ahora mismo",
    };
  }

  const resultado = await emailDriver().send({
    to: permiso.to,
    toName: args.toName ?? undefined,
    subject: args.email.subject,
    html: args.email.html,
    text: args.email.text,
    // Sin cabecera de baja: no es un correo comercial.
  });

  if (!resultado.ok) {
    // Se guarda el fallo y se SUELTA la marca, para que el reintento pueda
    // retomarlo. La fila se conserva: es lo que impide que salgan dos.
    await db.orderEmail.update({
      where: { id: reserva.id },
      data: { error: resultado.error.slice(0, 500), claimedAt: null },
    });
    return { sent: false, reason: "FALLO_PROVEEDOR", detail: resultado.error };
  }

  await db.orderEmail.update({
    where: { id: reserva.id },
    data: { sentAt: new Date(), providerId: resultado.providerId, error: null },
  });

  return { sent: true, providerId: resultado.providerId };
}

/** Qué correos se enviaron ya de un pedido. Para el diagnóstico. */
export async function orderEmails(orderId: string) {
  return db.orderEmail.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
}
