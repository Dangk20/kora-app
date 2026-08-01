// El contenido de una campaña: validación y render.
// Ver openspec/changes/email-marketing — specs/email-campaigns.

import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { renderCampaign, type TemplateProduct } from "@/modules/email/template";
import { storeUrl } from "@/modules/email/driver";
import { resolvePrice, toNumber } from "@/modules/pricing";
import { storage } from "@/modules/storage";
import { unsubscribeUrl } from "@/modules/consent/token";
import { MAX_ASUNTO, MAX_PREHEADER, MAX_PRODUCTOS, type Segment } from "./types";

export { MAX_ASUNTO, MAX_PREHEADER, MAX_PRODUCTOS } from "./types";

export type CampaignContent = {
  name: string;
  subject: string;
  preheader: string | null;
  title: string;
  body: string;
  imageKey: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  productIds: string[];
};

export type ContentProblem = { field: string; message: string };

export function validateContent(c: CampaignContent): ContentProblem[] {
  const p: ContentProblem[] = [];
  if (c.name.trim().length < 3) p.push({ field: "name", message: "Ponle un nombre a la campaña." });
  if (!c.subject.trim()) p.push({ field: "subject", message: "El asunto es obligatorio." });
  else if (c.subject.length > MAX_ASUNTO)
    p.push({ field: "subject", message: `El asunto no puede pasar de ${MAX_ASUNTO} caracteres.` });
  if (c.preheader && c.preheader.length > MAX_PREHEADER)
    p.push({ field: "preheader", message: `El preheader no puede pasar de ${MAX_PREHEADER} caracteres.` });
  if (!c.title.trim()) p.push({ field: "title", message: "El título es obligatorio." });
  if (!c.body.trim()) p.push({ field: "body", message: "El texto es obligatorio." });
  if (c.productIds.length > MAX_PRODUCTOS)
    p.push({ field: "productIds", message: `Máximo ${MAX_PRODUCTOS} productos destacados.` });
  if (c.ctaLabel && !c.ctaUrl) p.push({ field: "ctaUrl", message: "Falta el enlace del botón." });
  return p;
}

/**
 * La moneda de la audiencia, o null si es mixta.
 *
 * Mixta ⇒ los productos van SIN precio. No existe tasa de cambio en KORA y es
 * deliberado: un precio único para dos países le estaría mintiendo a la mitad
 * de la lista, y el operador se enteraría cobrando.
 */
export function audienceCurrency(segment: Segment): Currency | null {
  if (segment.country === "CO") return "COP";
  if (segment.country === "US") return "USD";
  return null;
}

/**
 * Resuelve los productos destacados.
 *
 * Los precios salen de `resolvePrice()`, la única fuente del proyecto —también
 * dentro de un correo—. Un producto que ya no está en el catálogo se retira en
 * vez de enviar un enlace roto; quien llama decide si avisar.
 */
export async function resolveProducts(
  productIds: string[],
  currency: Currency | null,
  base = storeUrl(),
): Promise<{ products: TemplateProduct[]; missing: string[] }> {
  if (productIds.length === 0) return { products: [], missing: [] };

  const encontrados = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true }, take: 1 },
    },
  });

  const porId = new Map(encontrados.map((p) => [p.id, p]));
  const missing = productIds.filter((id) => !porId.has(id));

  // Se conserva el orden que eligió el operador.
  const products: TemplateProduct[] = [];
  for (const id of productIds) {
    const p = porId.get(id);
    if (!p) continue;

    let price: TemplateProduct["price"] = null;
    const v = p.variants[0];
    if (currency && v) {
      const resuelto = resolvePrice(
        {
          priceCopStore: toNumber(v.priceCopStore),
          priceCopOnline: toNumber(v.priceCopOnline),
          priceUsdStore: toNumber(v.priceUsdStore),
          priceUsdOnline: toNumber(v.priceUsdOnline),
        },
        currency,
        "online",
      );
      if (resuelto.available) {
        price = {
          amount: resuelto.amount,
          currency,
          // El tachado solo si hay ahorro REAL en la misma moneda: la regla
          // que ya rige la ficha del producto.
          strikethrough: resuelto.hasOnlineDiscount ? resuelto.storeAmount : null,
        };
      }
    }

    products.push({
      name: p.name,
      url: `${base}/producto/${p.slug}`,
      imageUrl: p.images[0] ? storage().urlFor(p.images[0].url) : null,
      price,
    });
  }

  return { products, missing };
}

export type RenderedCampaign = { html: string; text: string; missing: string[] };

/**
 * Renderiza la campaña. ES EL MISMO CAMINO de la vista previa y del envío: lo
 * que el operador ve es lo que recibe el destinatario.
 */
export async function renderCampaignFor(args: {
  content: CampaignContent;
  segment: Segment;
  recipient: { id: string; name: string } | null;
}): Promise<RenderedCampaign> {
  const base = storeUrl();
  const currency = audienceCurrency(args.segment);
  const { products, missing } = await resolveProducts(args.content.productIds, currency, base);

  const { html, text } = renderCampaign({
    subject: args.content.subject,
    preheader: args.content.preheader,
    title: args.content.title,
    body: args.content.body,
    imageUrl: args.content.imageKey ? storage().urlFor(args.content.imageKey) : null,
    ctaLabel: args.content.ctaLabel,
    ctaUrl: args.content.ctaUrl || base,
    products,
    // En la vista previa el enlace apunta a un destinatario de ejemplo: el pie
    // legal tiene que verse siempre, o se revisaría un correo distinto del que
    // sale.
    unsubscribeUrl: unsubscribeUrl(args.recipient?.id ?? "vista-previa"),
    recipientName: args.recipient?.name ?? null,
    storeBase: base,
  });

  return { html, text, missing };
}
