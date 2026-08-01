// El despachador de campañas: envía por lotes, reanudable y sin duplicar.
// Ver openspec/changes/email-marketing — specs/email-delivery y email-campaigns.
//
// ⚠️ AQUÍ UN ERROR SE CONVIERTE EN CORREOS DUPLICADOS, y eso no se deshace: le
// llega al comprador, lo lee como descuido y las quejas que genera queman la
// reputación del dominio justo cuando se está construyendo.
//
// Tres decisiones sostienen la garantía:
//
//   1. El progreso NO se guarda en un contador. Cada destinatario es una fila
//      con su estado. Un contador de "por dónde iba" es un segundo estado que
//      se desincroniza en cuanto el proceso muere entre enviar y guardar el
//      avance — y lo que se desincroniza aquí son correos.
//
//   2. El lote se toma con `FOR UPDATE SKIP LOCKED`: dos despachadores a la vez
//      no pueden tomar el mismo destinatario. Leer no es reservar.
//
//   3. El destinatario se RESERVA antes de llamar al proveedor. Al revés, un
//      proceso que muere justo después de que el proveedor aceptó el correo
//      dejaría al destinatario como pendiente y la reanudación se lo mandaría
//      otra vez. Reservando antes, el peor caso es que alguien NO reciba un
//      correo; reservando después, que lo reciba dos veces. De los dos, el que
//      se puede corregir es el primero.

import type { Campaign } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { emailDriver } from "@/modules/email";
import { unsubscribeUrl } from "@/modules/consent/token";
import { renderCampaignFor, type CampaignContent } from "./content";
import type { Segment } from "./audience";

/** Cuántos correos por ejecución. Con un ciclo por minuto son 3.000 por hora. */
export const LOTE = Number(process.env.CAMPAIGN_BATCH ?? 50);

/**
 * Cuánto puede estar un destinatario reservado antes de considerarlo huérfano
 * de un proceso muerto. Debe superar con margen lo que tarda un envío.
 */
const RESERVA_HUERFANA_MS = 10 * 60_000;

export type DispatchResult = {
  campaignId: string | null;
  campaignName: string | null;
  sent: number;
  failed: number;
  skipped: number;
  finished: boolean;
};

const VACIO: DispatchResult = {
  campaignId: null,
  campaignName: null,
  sent: 0,
  failed: 0,
  skipped: 0,
  finished: false,
};

function contenidoDe(c: Campaign): CampaignContent {
  return {
    name: c.name,
    subject: c.subject,
    preheader: c.preheader,
    title: c.title,
    body: c.body,
    imageKey: c.imageKey,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    productIds: c.productIds,
  };
}

/** Devuelve a pendientes lo que quedó reservado por un proceso que murió. */
export async function releaseOrphanReservations(now = new Date()): Promise<number> {
  const r = await db.campaignRecipient.updateMany({
    where: { status: "SENDING", reservedAt: { lt: new Date(now.getTime() - RESERVA_HUERFANA_MS) } },
    data: { status: "PENDING", reservedAt: null },
  });
  return r.count;
}

/**
 * Toma un lote de pendientes y los reserva, en una sola transacción.
 *
 * `SKIP LOCKED` es lo que permite que dos despachadores corran a la vez sin
 * pelearse: el segundo salta las filas que el primero ya bloqueó en vez de
 * esperarlas.
 */
async function reservarLote(campaignId: string, limite: number): Promise<string[]> {
  return db.$transaction(async (tx) => {
    const filas = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM campaign_recipients
       WHERE "campaignId" = $1 AND status = 'PENDING'
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT ${limite}`,
      campaignId,
    );
    if (filas.length === 0) return [];

    const ids = filas.map((f) => f.id);
    await tx.campaignRecipient.updateMany({
      where: { id: { in: ids } },
      data: { status: "SENDING", reservedAt: new Date() },
    });
    return ids;
  });
}

/**
 * Segunda barrera de supresión.
 *
 * La primera se aplicó al armar la audiencia, pero entre eso y el último lote
 * pueden pasar horas. Quien se dio de baja en ese intervalo no puede recibir el
 * correo: cuesta una consulta por lote, y no comprobarlo cuesta el canal.
 */
async function siguenElegibles(customerIds: string[]): Promise<Set<string>> {
  const vivos = await db.customer.findMany({
    where: {
      id: { in: customerIds },
      acceptsMarketing: true,
      emailUsable: true,
      email: { not: null },
    },
    select: { id: true },
  });
  return new Set(vivos.map((c) => c.id));
}

/**
 * Procesa UN lote de la campaña indicada. Idempotente por destinatario.
 */
export async function dispatchBatch(
  campaignId: string,
  limite = LOTE,
): Promise<DispatchResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") return VACIO;

  const ids = await reservarLote(campaignId, limite);
  if (ids.length === 0) {
    // No queda nada pendiente: si tampoco hay nada en vuelo, la campaña terminó.
    const enVuelo = await db.campaignRecipient.count({
      where: { campaignId, status: { in: ["PENDING", "SENDING"] } },
    });
    if (enVuelo === 0) {
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: "SENT", sentAt: new Date() },
      });
      return { ...VACIO, campaignId, campaignName: campaign.name, finished: true };
    }
    return { ...VACIO, campaignId, campaignName: campaign.name };
  }

  const destinatarios = await db.campaignRecipient.findMany({ where: { id: { in: ids } } });
  const elegibles = await siguenElegibles(destinatarios.map((d) => d.customerId));

  const driver = emailDriver();
  const segment = campaign.segment as unknown as Segment;
  const contenido = contenidoDe(campaign);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const d of destinatarios) {
    if (!elegibles.has(d.customerId)) {
      await db.campaignRecipient.update({
        where: { id: d.id },
        data: { status: "SKIPPED", error: "se dio de baja o su correo dejó de ser utilizable" },
      });
      skipped += 1;
      continue;
    }

    // El correo se renderiza por destinatario: el saludo y el enlace de baja
    // son suyos. El enlace de baja de otro sería un fallo grave.
    const { html, text } = await renderCampaignFor({
      content: contenido,
      segment,
      recipient: { id: d.customerId, name: d.name },
    });

    const r = await driver.send({
      to: d.email,
      toName: d.name,
      subject: campaign.subject,
      html,
      text,
      unsubscribeUrl: unsubscribeUrl(d.customerId),
    });

    if (r.ok) {
      await db.campaignRecipient.update({
        where: { id: d.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: r.providerId,
          attempts: { increment: 1 },
          error: null,
        },
      });
      sent += 1;
    } else {
      // Un destinatario fallido NO bloquea el lote. Si el fallo es transitorio
      // vuelve a pendiente y lo reintenta la siguiente ejecución; si es
      // permanente, no tiene sentido gastar más intentos.
      await db.campaignRecipient.update({
        where: { id: d.id },
        data: {
          status: r.permanent || d.attempts >= 2 ? "FAILED" : "PENDING",
          reservedAt: null,
          attempts: { increment: 1 },
          error: r.error.slice(0, 500),
        },
      });
      if (r.permanent || d.attempts >= 2) failed += 1;
    }
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { sentCount: { increment: sent }, failedCount: { increment: failed } },
  });

  return { campaignId, campaignName: campaign.name, sent, failed, skipped, finished: false };
}

/**
 * Una ejecución del trabajo programado: recupera huérfanos y procesa un lote de
 * la campaña en curso más antigua.
 *
 * Una campaña a la vez, a propósito. Con este tamaño de negocio sobra, y en
 * serie el diagnóstico es legible: "la campaña X va por N".
 */
export async function dispatchOnce(limite = LOTE): Promise<DispatchResult> {
  await releaseOrphanReservations();

  const enCurso = await db.campaign.findFirst({
    where: { status: "SENDING" },
    orderBy: { sendStartedAt: "asc" },
    select: { id: true },
  });
  if (!enCurso) return VACIO;

  return dispatchBatch(enCurso.id, limite);
}
