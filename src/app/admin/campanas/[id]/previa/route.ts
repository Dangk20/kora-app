// Vista previa del correo, servida como HTML dentro de un iframe.
// Ver openspec/changes/email-marketing — specs/email-delivery.
//
// Usa EXACTAMENTE el mismo render que el envío. Si la vista previa tuviera su
// propio generador, se desincronizarían — y aquí el error se descubre después
// de mandárselo a diez mil personas.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Segment } from "@/modules/campaigns/audience";
import { renderCampaignFor } from "@/modules/campaigns/content";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.permissions.includes("marketing:view")) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { id } = await params;
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) return new NextResponse("No existe", { status: 404 });

  // Si ya salió, se muestra la copia inmutable: lo que recibió la gente.
  if (c.sentHtml) {
    return new NextResponse(c.sentHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { html } = await renderCampaignFor({
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

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Es un borrador: nunca se cachea, o el operador vería una versión vieja
      // de lo que acaba de cambiar.
      "Cache-Control": "no-store",
    },
  });
}
