// Consultas de lectura del módulo de campañas.
// Ver openspec/changes/email-marketing — specs/email-campaigns.

import type { CampaignStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { emailProviderConfigured } from "@/modules/email/config";
import { countAudience, describeSegment, type Segment } from "./audience";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  segmentLabel: string;
  /** Congelado si ya salió; estimado vigente si no. */
  recipients: number;
  recipientsAreEstimate: boolean;
  date: Date | null;
  sentCount: number;
  failedCount: number;
  unsubscribeCount: number;
};

async function nombresDeCategorias(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const cats = await db.category.findMany({ where: { id: { in: ids } }, select: { name: true } });
  return cats.map((c) => c.name);
}

export async function listCampaigns(status?: CampaignStatus): Promise<CampaignRow[]> {
  const campañas = await db.campaign.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { recipients: true } } },
  });

  return Promise.all(
    campañas.map(async (c) => {
      const segment = c.segment as unknown as Segment;
      const congelada = c.status === "SENDING" || c.status === "SENT";
      return {
        id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        segmentLabel: describeSegment(segment, await nombresDeCategorias(segment.categoryIds ?? [])),
        // En borrador el número es un estimado y se dice como tal: sin eso, el
        // operador lo lee como un compromiso.
        recipients: congelada ? c._count.recipients : await countAudience(segment),
        recipientsAreEstimate: !congelada,
        date: c.sentAt ?? c.scheduledAt ?? c.createdAt,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        unsubscribeCount: c.unsubscribeCount,
      };
    }),
  );
}

export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof campaignDetail>>>;

export async function campaignDetail(id: string) {
  const c = await db.campaign.findUnique({
    where: { id },
    include: { _count: { select: { recipients: true } } },
  });
  if (!c) return null;

  const segment = c.segment as unknown as Segment;
  const porEstado = await db.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: true,
  });
  const conteo = Object.fromEntries(porEstado.map((f) => [f.status, f._count]));

  return {
    id: c.id,
    name: c.name,
    status: c.status,
    subject: c.subject,
    preheader: c.preheader,
    title: c.title,
    body: c.body,
    imageKey: c.imageKey,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    productIds: c.productIds,
    segment,
    segmentLabel: describeSegment(segment, await nombresDeCategorias(segment.categoryIds ?? [])),
    scheduledAt: c.scheduledAt,
    sentAt: c.sentAt,
    sentHtml: c.sentHtml,
    recipients: c._count.recipients,
    pending: conteo.PENDING ?? 0,
    sending: conteo.SENDING ?? 0,
    sent: conteo.SENT ?? 0,
    failed: conteo.FAILED ?? 0,
    skipped: conteo.SKIPPED ?? 0,
    unsubscribeCount: c.unsubscribeCount,
    /**
     * Las métricas del proveedor (entregas confirmadas, aperturas, clics,
     * rebotes) llegan por webhook. Sin proveedor configurado NO se muestran
     * como cero: un cero se lee como "nadie lo abrió" y sobre esa lectura se
     * toman decisiones comerciales. Decir que no se mide todavía es
     * información; un cero es una afirmación falsa.
     */
    providerMetricsAvailable: emailProviderConfigured(),
  };
}
