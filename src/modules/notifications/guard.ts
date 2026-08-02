// A quién se le puede escribir.
// Ver openspec/changes/correos-transaccionales — specs/transactional-email.
//
// ⚠️ SON DOS LISTAS DISTINTAS, y hasta ahora el sistema tenía una sola.
//
//   · La BAJA DE MARKETING dice "no me mandes promociones". Frena campañas.
//     NO frena el comprobante de una compra: quien rechazó publicidad no
//     rechazó su factura, y negársela lo deja sin el número de pedido, sin el
//     detalle de lo que pagó y sin el enlace para cerrar el cobro por WhatsApp.
//
//   · La DIRECCIÓN NO UTILIZABLE dice "aquí no vive nadie" — rebotó o se quejó.
//     Frena TODO. Insistir no entrega nada y daña la reputación del dominio,
//     que es justo lo que hace que dejen de llegar los correos de los demás.
//
// Confundirlas rompe en las dos direcciones, y ninguna de las dos se nota
// desde dentro: o le niegas la factura a un comprador, o quemas el dominio.

import { db } from "@/lib/db";

export type NoEnviarMotivo =
  | "SIN_CORREO" // no hay dirección: no es un error
  | "DIRECCION_NO_UTILIZABLE" // rebotó o se quejó
  | "BAJA_DE_MARKETING"; // solo aplica a campañas

export type PuedeEnviar =
  | { ok: true; to: string }
  | { ok: false; reason: NoEnviarMotivo; detail: string };

const MOTIVO: Record<NoEnviarMotivo, string> = {
  SIN_CORREO: "no hay dirección de correo",
  DIRECCION_NO_UTILIZABLE: "la dirección rebotó o fue reportada",
  BAJA_DE_MARKETING: "se dio de baja de las comunicaciones comerciales",
};

/**
 * ¿Se le puede mandar un correo TRANSACCIONAL a esta dirección?
 *
 * La baja de marketing NO se consulta a propósito. La utilidad de la dirección
 * sí, porque es una propiedad de la dirección y no de la persona.
 */
export async function canSendTransactional(email: string | null): Promise<PuedeEnviar> {
  const to = email?.trim().toLowerCase();
  if (!to) {
    return { ok: false, reason: "SIN_CORREO", detail: MOTIVO.SIN_CORREO };
  }

  // Se pregunta por la DIRECCIÓN, no por el cliente del pedido: la misma
  // dirección puede aparecer en un pedido de invitado sin cliente asociado.
  const cliente = await db.customer.findUnique({
    where: { email: to },
    select: { emailUsable: true },
  });

  // Sin cliente registrado no hay nada que la marque como inservible: se envía.
  if (cliente && !cliente.emailUsable) {
    return {
      ok: false,
      reason: "DIRECCION_NO_UTILIZABLE",
      detail: MOTIVO.DIRECCION_NO_UTILIZABLE,
    };
  }

  return { ok: true, to };
}

/**
 * ¿Se le puede mandar una CAMPAÑA a este cliente?
 *
 * Aquí sí cuentan las dos listas. Existe para que la diferencia entre ambos
 * casos esté escrita en un solo archivo y no repartida por el código.
 */
export async function canSendMarketing(customerId: string): Promise<PuedeEnviar> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: { email: true, emailUsable: true, acceptsMarketing: true },
  });

  const to = c?.email?.trim().toLowerCase();
  if (!to) return { ok: false, reason: "SIN_CORREO", detail: MOTIVO.SIN_CORREO };
  if (!c!.emailUsable) {
    return { ok: false, reason: "DIRECCION_NO_UTILIZABLE", detail: MOTIVO.DIRECCION_NO_UTILIZABLE };
  }
  if (!c!.acceptsMarketing) {
    return { ok: false, reason: "BAJA_DE_MARKETING", detail: MOTIVO.BAJA_DE_MARKETING };
  }

  return { ok: true, to };
}
