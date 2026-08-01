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
