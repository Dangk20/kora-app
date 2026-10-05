import { BadgeCheck, ClipboardCheck, Home, Package, Truck, type LucideIcon } from "lucide-react";
import type { Currency, OrderStatus } from "@/generated/prisma/enums";
import { getMessages } from "@/modules/i18n/server";
import type { Messages } from "@/modules/i18n/messages";

export function money(valor: number, moneda: Currency): string {
  return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: moneda === "USD" ? 2 : 0,
  }).format(valor);
}

// En KORA el pago ocurre por WhatsApp, fuera de la plataforma: un pedido
// pendiente NO es un error, es el estado normal de una compra recién hecha. Si
// la cuenta no lo dice, el comprador cree que su compra falló y la repite.
//
// Solo el COLOR vive aquí; el texto sale del diccionario (`pedido.estado`), así
// el estado se traduce en la vista sin tocar el enum.
const CLASE_ESTADO: Record<OrderStatus, string> = {
  PENDING: "bg-[#FFF4EF] text-[#8a4520] border-[#ffd9c7]",
  CONFIRMED: "bg-[#EEF7EF] text-[#2c6b34] border-[#cfe6d3]",
  PREPARING: "bg-[#EEF3FA] text-[#2b4d7a] border-[#cfdcee]",
  SHIPPED: "bg-[#EEF3FA] text-[#2b4d7a] border-[#cfdcee]",
  DELIVERED: "bg-[#EEF7EF] text-[#2c6b34] border-[#cfe6d3]",
  CANCELLED: "bg-[#f5f3f0] text-[#6b6b6b] border-[#e2ddd6]",
};

export async function EstadoPedido({ status }: { status: OrderStatus }) {
  const t = await getMessages();
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[12px] font-semibold whitespace-nowrap ${CLASE_ESTADO[status]}`}
    >
      {t.pedido.estado[status]}
    </span>
  );
}

const TONO: Record<OrderStatus, string> = {
  PENDING: "text-[#b25a12]",
  CONFIRMED: "text-[#2c6b34]",
  PREPARING: "text-[#2c6b34]",
  SHIPPED: "text-[#2c6b34]",
  DELIVERED: "text-[#2c6b34]",
  CANCELLED: "text-[#6b6b6b]",
};

/**
 * El estado del pedido dicho como lo diría una persona: qué pasa y cuándo.
 * "Entregado el 27 de agosto" responde la pregunta; "DELIVERED" no. Y un
 * pedido pendiente NO es un fallo: aquí el pago se acuerda por WhatsApp.
 */
export function fraseDeEstado(
  status: OrderStatus,
  cuando: Date,
  t: Messages,
): { corta: string; titulo: string; detalle: string | null; tono: string } {
  const fecha = new Intl.DateTimeFormat(t.comun.formatoFecha, { day: "numeric", month: "long" }).format(cuando);
  const f = t.pedido.frase[status];
  return { corta: f.corta, titulo: f.titulo(fecha), detalle: f.detalle(fecha), tono: TONO[status] };
}

/**
 * Los pasos del recorrido de un pedido, en orden, cada uno con su icono: en
 * la línea de tiempo un punto dice "hubo algo aquí"; el icono dice QUÉ.
 * Cancelado no es un paso: es una salida. La etiqueta visible sale de
 * `pedido.pasos` en el diccionario; `label` queda como referencia en español.
 */
export const PASOS_PEDIDO: { status: OrderStatus; label: string; Icono: LucideIcon }[] = [
  { status: "PENDING", label: "Recibido", Icono: ClipboardCheck },
  { status: "CONFIRMED", label: "Confirmado", Icono: BadgeCheck },
  { status: "PREPARING", label: "En preparación", Icono: Package },
  { status: "SHIPPED", label: "Enviado", Icono: Truck },
  { status: "DELIVERED", label: "Entregado", Icono: Home },
];
