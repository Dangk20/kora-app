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
  /**
   * Obligatorio en CAMPAÑAS: el pie legal no es opcional.
   *
   * En un correo TRANSACCIONAL va vacío a propósito: ofrecer "date de baja" en
   * un comprobante promete algo que no se va a cumplir —el siguiente pedido
   * generará su correo igual— y marca el mensaje como comercial ante los
   * filtros, que es justo lo contrario de lo que conviene.
   */
  unsubscribeUrl: string;
  /** Líneas del pedido y totales, solo en los correos transaccionales. */
  order?: TemplateOrder | null;
  recipientName?: string | null;
  storeBase?: string;
  /**
   * Código de verificación, en grande y en su propia caja.
   *
   * Va como pieza de la plantilla y no como texto del cuerpo porque en un
   * correo así el código ES el contenido: quien lo abre viene a copiar seis
   * dígitos, muchas veces en el móvil y con prisa. Perdido en un párrafo hay
   * que buscarlo, y un dígito mal copiado se vive como que el sistema falla.
   */
  code?: string | null;
  /**
   * Línea de tiempo del pedido. `current` es el índice del paso en curso.
   *
   * Convierte "tu pedido está confirmado" en una respuesta a la pregunta que
   * el comprador se hace de verdad: y ahora qué, y cuánto falta.
   */
  timeline?: { steps: string[]; current: number } | null;
  /**
   * Texto que va DESPUÉS del código o de la línea de tiempo.
   *
   * Existe porque el orden importa: la caducidad de un código se lee después
   * del código, no antes. Meterlo todo en `body` obligaría a poner el aviso
   * arriba y el número abajo, que es justo al revés de como se usa el correo.
   */
  footer?: string | null;
};

export type TemplateOrderLine = {
  qty: number;
  name: string;
  variant?: string | null;
  total: number;
};

export type TemplateOrder = {
  number: string;
  currency: Currency;
  lines: TemplateOrderLine[];
  subtotal: number;
  discountTotal: number;
  cashbackApplied: number;
  total: number;
  /** Pie de detalle: cashback ganado, devuelto, etc. Ya redactado. */
  notes?: string[];
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

/**
 * El código, grande y en su propia caja.
 *
 * Tabla y estilos en línea, no flex ni grid: los clientes de correo son
 * navegadores de hace quince años y lo que no se dibuje con tablas se rompe en
 * Outlook. `letter-spacing` separa los dígitos para que se lean de un vistazo
 * y no se confundan al copiarlos a mano.
 */
function bloqueCodigo(code: string | null | undefined): string {
  if (!code) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
      <tr><td align="center" style="background:#F4F5F7;border-radius:12px;padding:22px 16px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1.1;font-weight:bold;letter-spacing:10px;color:${NEGRO};">${escapeHtml(
          code,
        )}</div>
      </td></tr>
    </table>`;
}

/**
 * La línea de tiempo del pedido.
 *
 * Dibujada con una tabla de una fila por el mismo motivo que el bloque del
 * código. Los pasos ya recorridos van en el naranja de la marca y los que
 * faltan en gris, con el punto del paso actual relleno: el estado se entiende
 * sin leer, que es como se mira un correo en el móvil.
 *
 * El texto de cada paso va SIEMPRE además en la versión de texto plano: quien
 * lea el correo sin imágenes ni estilos —o con un lector de pantalla— tiene que
 * poder saber en qué va su pedido.
 */
function lineaDeTiempo(t: { steps: string[]; current: number } | null | undefined): string {
  if (!t || t.steps.length === 0) return "";

  const celdas = t.steps
    .map((paso, i) => {
      const hecho = i <= t.current;
      const color = hecho ? NARANJA : "#c9ccd2";
      const punto = i === t.current
        ? `<div style="width:15px;height:15px;border-radius:50%;background:${NARANJA};border:3px solid #FFE0CC;margin:0 auto;"></div>`
        : `<div style="width:13px;height:13px;border-radius:50%;background:${hecho ? NARANJA : "#ffffff"};border:2px solid ${color};margin:0 auto;"></div>`;

      // La barra a la izquierda de cada punto salvo el primero: es lo que hace
      // que se lea como un recorrido y no como cuatro cosas sueltas.
      const barra = i === 0
        ? ""
        : `<td width="60" style="padding:0 0 12px;"><div style="height:3px;background:${hecho ? NARANJA : "#e4e6ea"};"></div></td>`;

      return `${barra}<td align="center" valign="top" style="padding:0 4px;">
          ${punto}
          <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${
            hecho ? NEGRO : GRIS
          };">${escapeHtml(paso)}</div>
        </td>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FAF8F5;border-radius:12px;">
      <tr><td style="padding:22px 14px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table>
      </td></tr>
    </table>`;
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
      ${bloqueCodigo(input.code)}
      ${lineaDeTiempo(input.timeline)}
      ${input.footer ? parrafos(input.footer) : ""}
      ${cta}
      ${tablaPedido(input.order)}
      ${parrillaProductos(input.products)}
    </td></tr>

    <!-- Pie legal: obligatorio en Colombia (Ley 1581) y en EE.UU. (CAN-SPAM),
         y KORA vende en los dos. Un correo sin pie identificable es además lo
         que un filtro de spam espera de un correo fraudulento. -->
    <tr><td style="padding:18px 26px 26px;border-top:1px solid #eee9e2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${GRIS};">
      <p style="margin:0 0 6px;">${NEGOCIO} · Todo lo que quieres, en un solo lugar</p>
      <p style="margin:0;">
        <a href="${base}/politica-de-datos" style="color:${GRIS};">Política de tratamiento de datos</a>
        ${
          input.unsubscribeUrl
            ? `&nbsp;·&nbsp;<a href="${input.unsubscribeUrl}" style="color:${GRIS};">Cancelar suscripción</a>`
            : ""
        }
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

  // El código y el estado también aquí, y no como adorno: quien lee sin
  // imágenes ni estilos —o con un lector de pantalla— viene exactamente a por
  // esto. Un correo cuya información esencial solo existe en el HTML es un
  // correo que no sirve para una parte de quien lo recibe.
  if (input.code) lineas.push(`Tu código: ${input.code}`, "");

  if (input.timeline && input.timeline.steps.length > 0) {
    lineas.push("Estado de tu pedido:");
    input.timeline.steps.forEach((paso, i) => {
      const marca = i < input.timeline!.current ? "[x]" : i === input.timeline!.current ? "[>]" : "[ ]";
      lineas.push(`  ${marca} ${paso}`);
    });
    lineas.push("");
  }

  if (input.footer) lineas.push(input.footer.trim(), "");

  if (input.ctaLabel && input.ctaUrl) lineas.push(`${input.ctaLabel}: ${input.ctaUrl}`, "");

  if (input.products.length > 0) {
    lineas.push("Productos destacados:");
    for (const p of input.products) {
      const precio = p.price ? ` — ${money(p.price.amount, p.price.currency)}` : "";
      lineas.push(`· ${p.name}${precio}`, `  ${p.url}`);
    }
    lineas.push("");
  }

  if (input.order) lineas.push(...pedidoTexto(input.order), "");

  lineas.push(
    "—",
    `${NEGOCIO} · Todo lo que quieres, en un solo lugar`,
    `Política de tratamiento de datos: ${base}/politica-de-datos`,
  );
  if (input.unsubscribeUrl) lineas.push(`Cancelar suscripción: ${input.unsubscribeUrl}`);
  return lineas.join("\n");
}

export function renderCampaign(input: TemplateInput): { html: string; text: string } {
  return { html: renderCampaignHtml(input), text: renderCampaignText(input) };
}


/**
 * El detalle del pedido dentro del correo.
 *
 * Los importes salen SIEMPRE en la moneda del pedido: no hay conversión en
 * KORA, y un correo que mostrara pesos para una compra en dólares sería un
 * comprobante equivocado en manos del comprador.
 */
function tablaPedido(order: TemplateOrder | null | undefined): string {
  if (!order) return "";
  const c = order.currency;

  const filas = order.lines
    .map(
      (l) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid #f0ece6;font-size:14px;color:${NEGRO};">
          ${escapeHtml(l.name)}${l.variant ? `<br /><span style="font-size:12px;color:${GRIS};">${escapeHtml(l.variant)}</span>` : ""}
          <span style="font-size:12px;color:${GRIS};"> × ${l.qty}</span>
        </td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid #f0ece6;font-size:14px;font-weight:bold;color:${NEGRO};white-space:nowrap;">${money(l.total, c)}</td>
      </tr>`,
    )
    .join("");

  const linea = (etiqueta: string, valor: string) =>
    `<tr><td style="padding:4px 0;font-size:13px;color:${GRIS};">${etiqueta}</td>
         <td align="right" style="padding:4px 0;font-size:13px;color:${NEGRO};white-space:nowrap;">${valor}</td></tr>`;

  const descuentos =
    (order.discountTotal > 0 ? linea("Descuento", `− ${money(order.discountTotal, c)}`) : "") +
    (order.cashbackApplied > 0
      ? linea("Kora Cashback", `− ${money(order.cashbackApplied, c)}`)
      : "");

  const notas = (order.notes ?? [])
    .map(
      (n) =>
        `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:${GRIS};">${escapeHtml(n)}</p>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
    <tr><td colspan="2" style="padding-bottom:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${GRIS};">Pedido ${escapeHtml(order.number)}</td></tr>
    ${filas}
    ${order.discountTotal > 0 || order.cashbackApplied > 0 ? linea("Subtotal", money(order.subtotal, c)) : ""}
    ${descuentos}
    <tr>
      <td style="padding:10px 0 0;font-size:15px;font-weight:bold;color:${NEGRO};">Total</td>
      <td align="right" style="padding:10px 0 0;font-size:17px;font-weight:bold;color:${NEGRO};white-space:nowrap;">${money(order.total, c)} ${c}</td>
    </tr>
  </table>${notas}`;
}

function pedidoTexto(order: TemplateOrder): string[] {
  const c = order.currency;
  const l: string[] = [`Pedido ${order.number}`, ""];
  for (const item of order.lines) {
    const v = item.variant ? ` (${item.variant})` : "";
    l.push(`· ${item.qty} x ${item.name}${v} — ${money(item.total, c)}`);
  }
  l.push("");
  if (order.discountTotal > 0) l.push(`Descuento: −${money(order.discountTotal, c)}`);
  if (order.cashbackApplied > 0) l.push(`Kora Cashback: −${money(order.cashbackApplied, c)}`);
  l.push(`Total: ${money(order.total, c)} ${c}`);
  for (const n of order.notes ?? []) l.push("", n);
  return l;
}
