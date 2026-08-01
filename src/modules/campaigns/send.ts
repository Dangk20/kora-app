// Iniciar el envío de una campaña.
// Ver openspec/changes/email-marketing — specs/email-campaigns.
//
// El paso a Enviando es EL momento crítico: congela la audiencia, congela el
// contenido y abre la puerta al despachador. Tiene que ocurrir exactamente una
// vez, aunque lo disparen a la vez el operador y el trabajo programado —una
// campaña programada cuyo operador además pulsa "Enviar ahora"—. Si los dos
// ganaran, cada destinatario recibiría dos correos.
//
// La garantía está en la BASE: una escritura condicional sobre el estado. Leer
// el estado y luego escribirlo dejaría una ventana en la que los dos ven
// "todavía no ha empezado". Es el mismo criterio que consume el uso de un cupón
// dentro de la transacción del pedido.

import { db } from "@/lib/db";
import { audienceMembers, type Segment } from "./audience";
import { renderCampaignFor, type CampaignContent } from "./content";

export type StartResult =
  | { ok: true; recipients: number }
  | { ok: false; error: string };

export async function startCampaign(campaignId: string): Promise<StartResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "La campaña no existe." };
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    return { ok: false, error: "Esta campaña ya se envió." };
  }
  if (campaign.status === "CANCELLED") {
    return { ok: false, error: "Esta campaña está cancelada. Duplícala para volver a enviarla." };
  }

  const segment = campaign.segment as unknown as Segment;

  // La audiencia se RECALCULA aquí, no se usa la del borrador: si la campaña
  // estaba programada, entre que se guardó y llegó su hora entró quien se
  // suscribió y salió quien se dio de baja.
  const miembros = await audienceMembers(segment);
  if (miembros.length === 0) {
    return { ok: false, error: "El segmento no tiene destinatarios. Ajusta los filtros." };
  }

  const contenido: CampaignContent = {
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader,
    title: campaign.title,
    body: campaign.body,
    imageKey: campaign.imageKey,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    productIds: campaign.productIds,
  };

  // Copia inmutable del contenido: un producto que cambie de precio o
  // desaparezca del catálogo no puede alterar un correo ya enviado. Se
  // renderiza sin destinatario — el saludo y el enlace de baja se personalizan
  // al enviar, pero el cuerpo es este.
  const { html, text, missing } = await renderCampaignFor({
    content: contenido,
    segment,
    recipient: null,
  });

  // Un producto que desapareció del catálogo se retira antes de enviar: mejor
  // una campaña con un producto menos que un enlace roto en diez mil correos.
  const productIds = missing.length > 0
    ? campaign.productIds.filter((id) => !missing.includes(id))
    : campaign.productIds;

  try {
    const n = await db.$transaction(async (tx) => {
      // ── Escritura condicional: el estado decide, y decide la base ──
      const cambiadas = await tx.$executeRaw`
        UPDATE campaigns
        SET status = 'SENDING', "sendStartedAt" = NOW(), "updatedAt" = NOW(),
            "sentHtml" = ${html}, "sentText" = ${text}, "productIds" = ${productIds}
        WHERE id = ${campaignId} AND status IN ('DRAFT', 'SCHEDULED')
      `;
      if (cambiadas === 0) throw new Error("YA_INICIADA");

      // La lista congelada: a quién se envía y con qué correo, tal como estaba.
      await tx.campaignRecipient.createMany({
        data: miembros.map((m) => ({
          campaignId,
          customerId: m.id,
          email: m.email,
          name: m.name,
        })),
        skipDuplicates: true,
      });

      return miembros.length;
    });

    return { ok: true, recipients: n };
  } catch (e) {
    if (e instanceof Error && e.message === "YA_INICIADA") {
      // Otro proceso ganó la carrera. El resultado es el que se buscaba: la
      // campaña se está enviando, y una sola vez.
      return { ok: false, error: "Esta campaña ya empezó a enviarse." };
    }
    throw e;
  }
}

/** Dispara las campañas programadas cuya hora llegó. Lo llama el trabajo. */
export async function startDueCampaigns(now = new Date()): Promise<{
  started: number;
  names: string[];
}> {
  const listas = await db.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, name: true },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });

  const names: string[] = [];
  for (const c of listas) {
    const r = await startCampaign(c.id);
    if (r.ok) names.push(c.name);
    else {
      // Un segmento que quedó vacío no puede dejar la campaña programada para
      // siempre reintentándose: se cancela con su motivo, visible en el panel.
      await db.campaign.updateMany({
        where: { id: c.id, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      });
    }
  }
  return { started: names.length, names };
}
