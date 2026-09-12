// Qué se hace con un evento del proveedor una vez verificado.
// Ver openspec/changes/consumo-y-metricas-de-correo — specs/email-provider-events.

import { db } from "@/lib/db";
import { recordHardBounce, recordSpamComplaint } from "@/modules/consent/suppression";

/** La forma del cuerpo que manda Resend. Solo lo que se usa. */
export type ProviderEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string };
    [k: string]: unknown;
  };
};

export type RecordResult = { stored: boolean; duplicate: boolean; effect: string | null };

function destinatario(e: ProviderEvent): string | null {
  const to = e.data?.to;
  if (Array.isArray(to)) return to[0]?.toLowerCase().trim() ?? null;
  if (typeof to === "string") return to.toLowerCase().trim();
  return null;
}

/**
 * Guarda el evento y aplica su efecto. Idempotente por `svixId`: el proveedor
 * reintenta hasta recibir 200, y un duplicado tiene que responder 200 sin
 * contar dos veces.
 */
export async function recordProviderEvent(svixId: string, event: ProviderEvent): Promise<RecordResult> {
  const providerId = event.data?.email_id;
  if (!providerId || !event.type) return { stored: false, duplicate: false, effect: "evento sin email_id o tipo" };

  const to = destinatario(event);
  try {
    await db.emailEvent.create({
      data: {
        svixId,
        providerId,
        type: event.type,
        to,
        occurredAt: event.created_at ? new Date(event.created_at) : new Date(),
        payload: event as object,
      },
    });
  } catch (e) {
    if (esDuplicado(e)) return { stored: false, duplicate: true, effect: null };
    throw e;
  }

  // Los efectos pasan por las funciones de supresión que ya existían para
  // esto: el webhook no escribe en `customers`.
  if (to && event.type === "email.bounced" && esReboteDuro(event)) {
    const r = await recordHardBounce(to);
    return { stored: true, duplicate: false, effect: r.applied ? "dirección marcada no utilizable" : null };
  }
  if (to && event.type === "email.complained") {
    const r = await recordSpamComplaint(to);
    return { stored: true, duplicate: false, effect: r.applied ? "cliente dado de baja" : null };
  }
  return { stored: true, duplicate: false, effect: null };
}

/**
 * Un rebote solo suprime si es PERMANENTE. Resend clasifica en Permanent,
 * Transient y Undetermined; un buzón lleno (transitorio) no es una dirección
 * mala, y suprimirla dejaría a un cliente sin correos por un día de mala
 * suerte. Sin clasificación se toma como permanente: es lo que más veces
 * acierta y el error del lado seguro.
 */
function esReboteDuro(e: ProviderEvent): boolean {
  const tipo = e.data?.bounce?.type?.toLowerCase();
  if (!tipo) return true;
  return tipo === "permanent";
}

function esDuplicado(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
}

/** Tipos que el proveedor emite y que el panel sabe leer. */
export const EVENT_TYPES = {
  delivered: "email.delivered",
  opened: "email.opened",
  clicked: "email.clicked",
  bounced: "email.bounced",
  complained: "email.complained",
} as const;
