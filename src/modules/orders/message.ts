// Mensaje de WhatsApp del pedido (PED_HU002 §2) y número legible del pedido.
// Función pura: se testea sin base de datos y produce exactamente el texto
// que el comprador envía desde su propio WhatsApp.
import { formatMoney, type Currency } from "@/modules/pricing";

/**
 * `KO-2026-00042` — consecutivo legible del pedido.
 *
 * El año se calcula en la zona horaria del negocio, NO en la del servidor:
 * un pedido del 31 de diciembre a las 8 p.m. en Colombia ya es 1 de enero en
 * UTC, y numerarlo con el año siguiente confundiría la contabilidad.
 */
const BUSINESS_TIMEZONE = "America/Bogota";

export function formatOrderNumber(number: number, createdAt: Date): string {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
  }).format(createdAt);
  return `KO-${year}-${String(number).padStart(5, "0")}`;
}

export type MessageItem = {
  qty: number;
  productName: string;
  variantName: string;
  unitPrice: number;
  lineTotal: number;
};

export type MessageInput = {
  orderNumber: string;
  currency: Currency;
  items: MessageItem[];
  total: number;
  discount?: { code: string; amount: number };
  contactName: string;
  contactPhone: string;
  address: string;
  paymentPreference: string;
};

export function buildWhatsappMessage(input: MessageInput): string {
  const money = (n: number) => formatMoney(n, input.currency);
  const lines: string[] = [
    `Hola KORA 👋, quiero confirmar mi pedido *${input.orderNumber}*:`,
    "",
  ];

  for (const item of input.items) {
    // La variante solo aparece si aporta información ("Única" es ruido).
    const variant =
      item.variantName && item.variantName.toLowerCase() !== "única"
        ? ` (${item.variantName})`
        : "";
    lines.push(
      `• ${item.qty} x ${item.productName}${variant} — ${money(item.unitPrice)} = ${money(item.lineTotal)}`,
    );
  }

  if (input.discount) {
    lines.push(`Cupón ${input.discount.code}: −${money(input.discount.amount)}`);
  }

  lines.push(
    "",
    `Total: ${money(input.total)} ${input.currency}`,
    `Entrega: ${input.address}`,
    `Pago: ${input.paymentPreference}`,
    `Nombre: ${input.contactName} · Tel: ${input.contactPhone}`,
  );

  return lines.join("\n");
}

/**
 * Enlace al chat con el mensaje pre-armado.
 *
 * Se usa `api.whatsapp.com/send` y NO el corto `wa.me`: wa.me hace una
 * redirección que vuelve a codificar el texto y en el camino destroza los
 * caracteres de 4 bytes — el emoji 👋 del saludo llegaba como "�". Yendo
 * directo al destino final no hay re-codificación y el mensaje llega igual.
 */
export function whatsappUrl(phoneE164: string, message: string): string {
  // El número viaja sin "+" ni separadores.
  const number = phoneE164.replace(/[^\d]/g, "");
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
}

/** Dirección compacta para el mensaje, según el país del formulario. */
export function compactAddress(data: {
  country: string;
  address: string;
  address2?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  zip?: string | null;
}): string {
  const parts: string[] = [data.address];
  if (data.address2) parts.push(data.address2);
  if (data.country === "CO") {
    if (data.neighborhood) parts.push(`Barrio ${data.neighborhood}`);
    parts.push(`${data.city}, ${data.state}`);
  } else {
    parts.push(`${data.city}, ${data.state}${data.zip ? ` ${data.zip}` : ""}`);
  }
  return parts.filter(Boolean).join(", ");
}
