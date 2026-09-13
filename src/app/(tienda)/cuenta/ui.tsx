import type { Currency, OrderStatus } from "@/generated/prisma/enums";

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
const ESTADO: Record<OrderStatus, { texto: string; clase: string }> = {
  PENDING: { texto: "Por confirmar", clase: "bg-[#FFF4EF] text-[#8a4520] border-[#ffd9c7]" },
  CONFIRMED: { texto: "Confirmado", clase: "bg-[#EEF7EF] text-[#2c6b34] border-[#cfe6d3]" },
  PREPARING: { texto: "En preparación", clase: "bg-[#EEF3FA] text-[#2b4d7a] border-[#cfdcee]" },
  SHIPPED: { texto: "Enviado", clase: "bg-[#EEF3FA] text-[#2b4d7a] border-[#cfdcee]" },
  DELIVERED: { texto: "Entregado", clase: "bg-[#EEF7EF] text-[#2c6b34] border-[#cfe6d3]" },
  CANCELLED: { texto: "Cancelado", clase: "bg-[#f5f3f0] text-[#6b6b6b] border-[#e2ddd6]" },
};

export function EstadoPedido({ status }: { status: OrderStatus }) {
  const e = ESTADO[status];
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[12px] font-semibold whitespace-nowrap ${e.clase}`}
    >
      {e.texto}
    </span>
  );
}


const fechaCorta = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(d);

/**
 * El estado del pedido dicho como lo diría una persona: qué pasa y cuándo.
 * "Entregado el 27 de agosto" responde la pregunta; "DELIVERED" no. Y un
 * pedido pendiente NO es un fallo: aquí el pago se acuerda por WhatsApp.
 */
export function fraseDeEstado(
  status: OrderStatus,
  cuando: Date,
): { corta: string; titulo: string; detalle: string | null; tono: string } {
  switch (status) {
    case "PENDING":
      return { corta: "Por confirmar", titulo: "Estamos esperando tu pago", detalle: "Se acuerda por WhatsApp. Retoma la conversación para confirmarlo.", tono: "text-[#b25a12]" };
    case "CONFIRMED":
      return { corta: "Pago confirmado", titulo: `Confirmado el ${fechaCorta(cuando)}`, detalle: "Estamos armando tu pedido.", tono: "text-[#2c6b34]" };
    case "PREPARING":
      return { corta: "En preparación", titulo: "Estamos preparando tu paquete", detalle: `Desde el ${fechaCorta(cuando)}.`, tono: "text-[#2c6b34]" };
    case "SHIPPED":
      return { corta: "En camino", titulo: `Enviado el ${fechaCorta(cuando)}`, detalle: "Te avisamos por correo cuando llegue.", tono: "text-[#2c6b34]" };
    case "DELIVERED":
      return { corta: "Entregado", titulo: `Llegó el ${fechaCorta(cuando)}`, detalle: null, tono: "text-[#2c6b34]" };
    case "CANCELLED":
      return { corta: "Cancelado", titulo: `Cancelado el ${fechaCorta(cuando)}`, detalle: "Si usaste cashback, ya volvió a tu saldo.", tono: "text-[#6b6b6b]" };
  }
}

/** Los pasos del recorrido de un pedido, en orden. Cancelado no es un paso: es una salida. */
export const PASOS_PEDIDO: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "Recibido" },
  { status: "CONFIRMED", label: "Confirmado" },
  { status: "PREPARING", label: "En preparación" },
  { status: "SHIPPED", label: "Enviado" },
  { status: "DELIVERED", label: "Entregado" },
];
