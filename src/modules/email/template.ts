// La plantilla de marca de KORA. UN SOLO generador.
// Ver openspec/changes/email-marketing — specs/email-delivery y email-campaigns.
//
// Lo que el operador ve en la vista previa es exactamente lo que se envía. Dos
// generadores se desincronizan, y aquí el error se descubre después de
// mandárselo a diez mil personas.
//
// El HTML es deliberadamente ANTICUADO: tablas, anchos fijos y estilos en
// línea. Un cliente de correo no es un navegador — Outlook usa el motor de
// Word, y Gmail descarta la hoja de estilos. Lo que aquí parece atraso es lo
// único que se ve igual en todas partes.
//
// La versión de texto plano NO es un extra: su ausencia es una de las señales
// que los filtros de spam usan para clasificar, y este dominio todavía no tiene
// reputación que lo compense.

import type { Currency } from "@/generated/prisma/enums";
import { storeUrl } from "./driver";

// Paleta oficial (src/app/globals.css). En un correo no hay variables CSS:
// los valores van literales.
const NARANJA = "#FF6A00";
const MORADO = "#7A3DB8";
const NEGRO = "#121212";
const GRIS = "#6b6f78";
const BEIGE = "#F9F3EE";

export type TemplateProduct = {
  name: string;
  url: string;
  imageUrl: string | null;
  /** null = audiencia mixta: no se muestra precio, se enlaza a la ficha. */
  price: { amount: number; currency: Currency; strikethrough: number | null } | null;
};

export type TemplateInput = {
  subject: string;
  preheader?: string | null;
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  products: TemplateProduct[];
  /** Obligatorio en campañas: el pie legal no es opcional. */
  unsubscribeUrl: string;
  recipientName?: string | null;
  storeBase?: string;
};

const NEGOCIO = "KORA";

function money(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
}

/** Escapa lo que viene del operador: el asunto y el cuerpo son texto, no HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Los saltos de línea del editor simple se vuelven párrafos. */
function parrafos(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${NEGRO};">${escapeHtml(
          p,
        ).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

function producto(p: TemplateProduct): string {
  const imagen = p.imageUrl
    ? `<img src="${p.imageUrl}" width="260" alt="${escapeHtml(p.name)}" style="display:block;width:100%;max-width:260px;height:auto;border:0;border-radius:10px;" />`
    : `<div style="width:100%;max-width:260px;height:140px;background:${BEIGE};border-radius:10px;"></div>`;

  // Audiencia mixta → sin precio. No existe tasa de cambio en KORA: un precio
  // único para dos países le estaría mintiendo a la mitad de la lista.
  const precio = p.price
    ? `<div style="margin-top:6px;font-size:15px;font-weight:bold;color:${NEGRO};">
         ${money(p.price.amount, p.price.currency)}
         ${
           p.price.strikethrough
             ? `<span style="margin-left:6px;font-weight:normal;font-size:13px;color:${GRIS};text-decoration:line-through;">${money(
                 p.price.strikethrough,
                 p.price.currency,
               )}</span>`
             : ""
         }
       </div>`
    : `<div style="margin-top:6px;font-size:13px;color:${GRIS};">Ver precio en la tienda</div>`;

  return `<td style="padding:8px;vertical-align:top;width:50%;">
    <a href="${p.url}" style="text-decoration:none;color:${NEGRO};">
      ${imagen}
      <div style="margin-top:8px;font-size:14px;font-weight:600;color:${NEGRO};">${escapeHtml(p.name)}</div>
      ${precio}
    </a>
  </td>`;
}

function parrillaProductos(products: TemplateProduct[]): string {
  if (products.length === 0) return "";
  const filas: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const par = products.slice(i, i + 2);
    const celdas = par.map(producto).join("");
    const relleno = par.length === 1 ? '<td style="width:50%;"></td>' : "";
    filas.push(`<tr>${celdas}${relleno}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">${filas.join(
    "",
  )}</table>`;
}

export function renderCampaignHtml(input: TemplateInput): string {
  const base = input.storeBase ?? storeUrl();
  const saludo = input.recipientName
    ? `<p style="margin:0 0 10px;font-size:15px;color:${NEGRO};">Hola, ${escapeHtml(
        input.recipientName.split(" ")[0],
      )} 👋</p>`
    : "";

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
           <tr><td style="border-radius:999px;background:${NARANJA};">
             <a href="${input.ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(
               input.ctaLabel,
             )}</a>
           </td></tr>
         </table>`
      : "";

  const banner = input.imageUrl
    ? `<img src="${input.imageUrl}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BEIGE};">
<!-- El preheader es lo que la bandeja muestra junto al asunto. Oculto en el
     cuerpo, pero decide si el correo se abre. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    input.preheader ?? "",
  )}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BEIGE};">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

    <tr><td style="background:linear-gradient(135deg,${NARANJA},${MORADO});background-color:${NARANJA};padding:22px 26px;">
      <a href="${base}" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;letter-spacing:2px;color:#ffffff;text-decoration:none;">KORA</a>
    </td></tr>

    ${banner ? `<tr><td>${banner}</td></tr>` : ""}

    <tr><td style="padding:26px;font-family:Arial,Helvetica,sans-serif;">
      ${saludo}
      <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:${NEGRO};">${escapeHtml(
        input.title,
      )}</h1>
      ${parrafos(input.body)}
      ${cta}
      ${parrillaProductos(input.products)}
    </td></tr>

    <!-- Pie legal: obligatorio en Colombia (Ley 1581) y en EE.UU. (CAN-SPAM),
         y KORA vende en los dos. Un correo sin pie identificable es además lo
         que un filtro de spam espera de un correo fraudulento. -->
    <tr><td style="padding:18px 26px 26px;border-top:1px solid #eee9e2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${GRIS};">
      <p style="margin:0 0 6px;">${NEGOCIO} · Todo lo que quieres, en un solo lugar</p>
      <p style="margin:0;">
        <a href="${base}/politica-de-datos" style="color:${GRIS};">Política de tratamiento de datos</a>
        &nbsp;·&nbsp;
        <a href="${input.unsubscribeUrl}" style="color:${GRIS};">Cancelar suscripción</a>
      </p>
    </td></tr>

  </table>

</td></tr>
</table>
</body></html>`;
}

/** La misma información, para quien no ve HTML. */
export function renderCampaignText(input: TemplateInput): string {
  const base = input.storeBase ?? storeUrl();
  const lineas: string[] = [];

  if (input.recipientName) lineas.push(`Hola, ${input.recipientName.split(" ")[0]}`, "");
  lineas.push(input.title.toUpperCase(), "");
  lineas.push(input.body.trim(), "");

  if (input.ctaLabel && input.ctaUrl) lineas.push(`${input.ctaLabel}: ${input.ctaUrl}`, "");

  if (input.products.length > 0) {
    lineas.push("Productos destacados:");
    for (const p of input.products) {
      const precio = p.price ? ` — ${money(p.price.amount, p.price.currency)}` : "";
      lineas.push(`· ${p.name}${precio}`, `  ${p.url}`);
    }
    lineas.push("");
  }

  lineas.push(
    "—",
    `${NEGOCIO} · Todo lo que quieres, en un solo lugar`,
    `Política de tratamiento de datos: ${base}/politica-de-datos`,
    `Cancelar suscripción: ${input.unsubscribeUrl}`,
  );
  return lineas.join("\n");
}

export function renderCampaign(input: TemplateInput): { html: string; text: string } {
  return { html: renderCampaignHtml(input), text: renderCampaignText(input) };
}
