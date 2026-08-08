"use server";

// Acciones del panel de campañas.
// Ver openspec/changes/email-marketing — specs/email-campaigns.
//
// Toda acción pasa por `requirePermission`, que verifica contra la BASE y no
// contra el JWT. `marketing:send` está separado de `marketing:create` a
// propósito: componer una campaña y dispararle un correo a toda la base de
// clientes no son el mismo nivel de responsabilidad.

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { emailDriver } from "@/modules/email";
import { unsubscribeUrl } from "@/modules/consent/token";
import { SEGMENTO_VACIO, countAudience, type Segment } from "./audience";
import { renderCampaignFor, validateContent, type CampaignContent } from "./content";
import { startCampaign } from "./send";
import { isCancellable, isDeletable, isEditable } from "./status";
import { assertMarketingUnlocked } from "./lock";

const RUTA = "/admin/campanas";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; field?: string };

function revalidar(id?: string) {
  revalidatePath(RUTA);
  if (id) revalidatePath(`${RUTA}/${id}`);
}

function leerContenido(f: FormData): CampaignContent {
  return {
    name: String(f.get("name") ?? "").trim(),
    subject: String(f.get("subject") ?? "").trim(),
    preheader: String(f.get("preheader") ?? "").trim() || null,
    title: String(f.get("title") ?? "").trim(),
    body: String(f.get("body") ?? "").trim(),
    imageKey: String(f.get("imageKey") ?? "").trim() || null,
    ctaLabel: String(f.get("ctaLabel") ?? "").trim() || null,
    ctaUrl: String(f.get("ctaUrl") ?? "").trim() || null,
    productIds: String(f.get("productIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function leerSegmento(f: FormData): Segment {
  const pais = String(f.get("country") ?? "ambos");
  return {
    country: pais === "CO" || pais === "US" ? pais : "ambos",
    activity: (String(f.get("activity") ?? "todos") as Segment["activity"]) || "todos",
    account: (String(f.get("account") ?? "todos") as Segment["account"]) || "todos",
    categoryIds: String(f.get("categoryIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export async function saveCampaign(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const session = await requirePermission("marketing:create");
  assertMarketingUnlocked();

  const id = String(f.get("id") ?? "").trim() || null;
  const contenido = leerContenido(f);
  const segmento = leerSegmento(f);

  const problemas = validateContent(contenido);
  if (problemas.length > 0) {
    return { ok: false, error: problemas[0].message, field: problemas[0].field };
  }

  if (id) {
    const actual = await db.campaign.findUnique({ where: { id }, select: { status: true } });
    if (!actual) return { ok: false, error: "La campaña no existe." };
    // Una campaña que ya salió no se edita: produciría dos correos distintos
    // bajo el mismo nombre y nadie podría decir qué recibió cada quien.
    if (!isEditable(actual.status)) {
      return { ok: false, error: "Esta campaña ya no se puede editar. Duplícala para cambiarla." };
    }
    await db.campaign.update({
      where: { id },
      data: { ...contenido, segment: segmento as unknown as object },
    });
    revalidar(id);
    return { ok: true, id };
  }

  const creada = await db.campaign.create({
    data: {
      ...contenido,
      segment: segmento as unknown as object,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  revalidar(creada.id);
  return { ok: true, id: creada.id };
}

/** Conteo en vivo mientras el operador ajusta los filtros. */
export async function estimateAudience(segment: Segment): Promise<number> {
  await requirePermission("marketing:view");
  assertMarketingUnlocked();
  return countAudience(segment);
}

/**
 * Correo de prueba: NO consume audiencia ni métricas.
 *
 * Es el único freno real antes de un envío masivo, así que tiene que usar
 * exactamente el mismo render que el envío: probar algo distinto de lo que sale
 * no prueba nada.
 */
export async function sendTestEmail(campaignId: string, to: string): Promise<ActionResult> {
  await requirePermission("marketing:create");
  assertMarketingUnlocked();

  const c = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!c) return { ok: false, error: "La campaña no existe." };
  if (!to.includes("@")) return { ok: false, error: "Escribe un correo válido." };

  const { html, text } = await renderCampaignFor({
    content: {
      name: c.name,
      subject: c.subject,
      preheader: c.preheader,
      title: c.title,
      body: c.body,
      imageKey: c.imageKey,
      ctaLabel: c.ctaLabel,
      ctaUrl: c.ctaUrl,
      productIds: c.productIds,
    },
    segment: c.segment as unknown as Segment,
    recipient: null,
  });

  const r = await emailDriver().send({
    to: to.trim(),
    subject: `[PRUEBA] ${c.subject}`,
    html,
    text,
    unsubscribeUrl: unsubscribeUrl("prueba"),
  });

  return r.ok
    ? { ok: true, message: `Correo de prueba enviado a ${to.trim()}.` }
    : { ok: false, error: `No se pudo enviar la prueba: ${r.error}` };
}

export async function scheduleCampaign(id: string, when: Date): Promise<ActionResult> {
  await requirePermission("marketing:send");
  assertMarketingUnlocked();

  const c = await db.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) return { ok: false, error: "La campaña no existe." };
  if (!isEditable(c.status)) return { ok: false, error: "Esta campaña ya no se puede programar." };
  if (when.getTime() <= Date.now()) {
    return { ok: false, error: "La fecha de envío tiene que ser futura." };
  }

  await db.campaign.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt: when },
  });
  revalidar(id);
  return { ok: true, id };
}

/** Dispara el envío. Idempotente: la garantía está en `startCampaign`. */
export async function sendNow(id: string): Promise<ActionResult> {
  await requirePermission("marketing:send");
  assertMarketingUnlocked();
  const r = await startCampaign(id);
  revalidar(id);
  return r.ok
    ? { ok: true, id, message: `Enviando a ${r.recipients} destinatario(s).` }
    : { ok: false, error: r.error };
}

export async function cancelCampaign(id: string): Promise<ActionResult> {
  await requirePermission("marketing:send");
  assertMarketingUnlocked();

  const c = await db.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) return { ok: false, error: "La campaña no existe." };
  // Una campaña en curso NO se cancela: los correos ya están saliendo y el
  // botón mentiría.
  if (!isCancellable(c.status)) {
    return { ok: false, error: "Solo se cancelan campañas programadas, antes de que empiecen." };
  }

  await db.campaign.update({ where: { id }, data: { status: "CANCELLED", scheduledAt: null } });
  revalidar(id);
  return { ok: true, id };
}

/** Duplicar crea un BORRADOR nuevo. La original no se toca: es histórico. */
export async function duplicateCampaign(id: string): Promise<ActionResult> {
  const session = await requirePermission("marketing:create");
  assertMarketingUnlocked();

  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "La campaña no existe." };

  const copia = await db.campaign.create({
    data: {
      name: `${c.name} (copia)`,
      subject: c.subject,
      preheader: c.preheader,
      title: c.title,
      body: c.body,
      imageKey: c.imageKey,
      ctaLabel: c.ctaLabel,
      ctaUrl: c.ctaUrl,
      productIds: c.productIds,
      segment: c.segment ?? (SEGMENTO_VACIO as unknown as object),
      createdById: session.user.id,
    },
    select: { id: true },
  });
  revalidar();
  return { ok: true, id: copia.id };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  await requirePermission("marketing:create");
  assertMarketingUnlocked();

  const c = await db.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) return { ok: false, error: "La campaña no existe." };
  if (!isDeletable(c.status)) {
    return { ok: false, error: "Solo se eliminan borradores. Lo enviado es histórico." };
  }

  await db.campaign.delete({ where: { id } });
  revalidar();
  return { ok: true };
}
