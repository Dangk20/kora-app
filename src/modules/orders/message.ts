// Mensaje de WhatsApp del pedido (PED_HU002 §2) y número legible del pedido.
// Función pura: se testea sin base de datos y produce exactamente el texto
// que el comprador envía desde su propio WhatsApp.
import { BUSINESS_TIMEZONE } from "@/lib/business-time";
import { formatMoney, type Currency } from "@/modules/pricing";

/**
 * `KO-2026-00042` — consecutivo legible del pedido.
 *
 * El año se calcula en la zona horaria del negocio, NO en la del servidor:
 * un pedido del 31 de diciembre a las 8 p.m. en Colombia ya es 1 de enero en
 * UTC, y numerarlo con el año siguiente confundiría la contabilidad.
 */
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
  /**
   * Cashback aplicado. Va como línea PROPIA, distinta del cupón: este mensaje
   * es el documento con el que el operador cobra, y si no puede distinguir de
   * dónde sale cada rebaja no se la puede explicar al comprador.
   */
  cashbackApplied?: number;
  contactName: string;
  contactPhone: string;
  /** Dirección en líneas: calle primero, ciudad y departamento después. */
  address: string[];
  paymentPreference: string;
};

export function buildWhatsappMessage(input: MessageInput): string {
  const money = (n: number) => formatMoney(n, input.currency);

  const lines: string[] = [
    "🛒 NUEVO PEDIDO | KORA",
    "",
    `#${input.orderNumber}`,
    "",
    `👤 ${input.contactName}`,
    `📞 ${input.contactPhone}`,
    "",
    "📦 Productos",
    "",
  ];

  for (const item of input.items) {
    lines.push(`${item.qty} × ${item.productName}`);
    // Los detalles de la variante van en viñetas propias: el operador tiene
    // que poder leer talla y color de un vistazo, sin descifrar una línea
    // larga. Es el mensaje con el que separa la mercancía.
    for (const detalle of variantDetails(item.variantName)) {
      lines.push(`• ${detalle}`);
    }
    lines.push(money(item.lineTotal), "");
  }

  // Las rebajas van ANTES del total y cada una por su lado: este mensaje es el
  // documento con el que se cobra, y si el operador no puede distinguir de
  // dónde sale cada descuento no se lo puede explicar al comprador.
  if (input.discount) {
    lines.push(`🎟️ Cupón ${input.discount.code}: −${money(input.discount.amount)}`);
  }
  if (input.cashbackApplied && input.cashbackApplied > 0) {
    lines.push(`🔥 Kora Cashback: −${money(input.cashbackApplied)}`);
  }
  if (input.discount || (input.cashbackApplied && input.cashbackApplied > 0)) {
    lines.push("");
  }

  lines.push(
    `💰 Total: ${money(input.total)} ${input.currency}`,
    `💳 Pago: ${input.paymentPreference}`,
    "",
    "📍 Entrega",
    ...input.address.filter(Boolean),
    "",
    "🟠 Estado: Nuevo pedido",
  );

  return lines.join("\n");
}

/**
 * Los detalles de una variante, uno por viñeta.
 *
 * Hoy la variante es UN texto (`"Talla M · Negro"`), no atributos separados,
 * así que se parte por los separadores que se usan al cargarla. Si el catálogo
 * viene con `"Talla: M · Color: Negro"`, cada par sale en su línea tal cual.
 *
 * "Única" no se muestra: es el nombre que lleva un producto sin variantes y
 * decirlo solo añade ruido a un mensaje que se lee en un teléfono.
 */
export function variantDetails(variantName: string): string[] {
  const limpio = variantName?.trim() ?? "";
  if (!limpio || limpio.toLowerCase() === "única" || limpio.toLowerCase() === "unica") {
    return [];
  }

  return limpio
    .split(/\s*[·|/]\s*|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
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

/**
 * Dirección en DOS líneas para el mensaje: la calle arriba, la ciudad abajo.
 *
 * Se separa porque el operador la copia para el domiciliario, y una sola línea
 * larga en WhatsApp se parte por donde quiere el teléfono — a veces en mitad
 * del número de la casa.
 */
export function addressLines(data: {
  country: string;
  address: string;
  address2?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  zip?: string | null;
}): string[] {
  const calle = [data.address, data.address2].filter(Boolean).join(", ");

  const lugar =
    data.country === "CO"
      ? [data.neighborhood ? `Barrio ${data.neighborhood}` : null, data.city, data.state]
          .filter(Boolean)
          .join(", ")
      : [data.city, `${data.state}${data.zip ? ` ${data.zip}` : ""}`].filter(Boolean).join(", ");

  return [calle, lugar].filter(Boolean);
}

/** Dirección en una línea. La usa el pedido guardado, no el mensaje. */
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
