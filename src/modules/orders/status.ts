// Máquina de estados del pedido (PED_HU003 §1).
//
// Solo se avanza hacia adelante, o se cancela desde Pendiente/Confirmado.
// Cualquier otra combinación se rechaza: el historial es append-only y el
// estado de la columna siempre refleja el último registro.
import type { OrderStatus } from "@/generated/prisma/client";

export const ORDER_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

/**
 * Badges de estado sobre la paleta oficial de marca (naranja → rosa → morado).
 * El avance del pedido se lee como un recorrido por el gradiente: arranca
 * neutro y termina en el morado del cierre. Cancelado usa el rojo semántico,
 * que es la única excepción al manual (ver notas técnicas).
 */
export const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string }> = {
  PENDING: { bg: "#f0ece6", color: "#8a8f98" },
  CONFIRMED: { bg: "#FFE9DD", color: "#FF5A1F" },
  PREPARING: { bg: "#FDE4D3", color: "#C4551A" },
  SHIPPED: { bg: "#FBDCE9", color: "#F2357E" },
  DELIVERED: { bg: "#EFE6F7", color: "#7A3DB8" },
  CANCELLED: { bg: "#fce8e8", color: "#E5484D" },
};

export const CANCEL_REASONS = [
  "El cliente desistió",
  "Sin stock disponible",
  "Datos incorrectos",
  "Otro",
] as const;

/**
 * Validez del pedido pendiente antes de expirar (PED_HU003 §2).
 *
 * **24 h desde el 27 ago 2026**, a petición del cliente en la reunión del 7 de
 * agosto. Antes eran 2 h.
 *
 * ⚠️ El efecto de segundo orden, que no se ve y hay que tener presente: el
 * stock **no** se reserva —decisión cerrada en julio—, así que alargar la
 * vigencia no bloquea inventario a nadie. Pero **el Kora Cashback SÍ se
 * descuenta al CREAR el pedido**, así que con 24 h el saldo de un comprador
 * queda comprometido un día entero por un pedido que quizá nunca se confirme.
 * Es aceptable —el saldo vuelve a sus lotes originales al expirar— pero es un
 * cambio real de comportamiento para el comprador, no solo un número.
 *
 * ⚠️ **Esta es la ÚNICA definición.** Hasta hoy había dos: esta, que solo
 * redactaba el texto de `/legal/terminos`, y una copia en
 * `checkout-actions.ts` que era la que de verdad escribía `expiresAt`. Cambiar
 * una sin la otra publicaba unas condiciones que prometían un plazo distinto
 * del que el sistema aplicaba, con la suite entera en verde: la prueba que
 * vigila el texto legal lo comparaba contra la constante equivocada.
 */
export const ORDER_TTL_HOURS = 24;

/** La misma vigencia en milisegundos. Derivada, nunca escrita a mano. */
export const ORDER_TTL_MS = ORDER_TTL_HOURS * 60 * 60 * 1000;
/** Un pendiente a menos de esto se marca como "por expirar" en el listado. */
export const EXPIRING_SOON_MINUTES = 30;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === "CANCELLED" || from === "DELIVERED") return false;
  // Cancelar solo desde Pendiente o Confirmado.
  if (to === "CANCELLED") return from === "PENDING" || from === "CONFIRMED";
  const fromIndex = ORDER_FLOW.indexOf(from);
  const toIndex = ORDER_FLOW.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex > fromIndex; // solo hacia adelante
}

/** Siguiente estado natural del flujo, para el botón de avance del detalle. */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  const index = ORDER_FLOW.indexOf(current);
  if (index === -1 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1];
}

/** Minutos que le quedan de validez a un pendiente (negativo = ya expiró). */
export function minutesLeft(expiresAt: Date | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.round((expiresAt.getTime() - now.getTime()) / 60000);
}

/** "1 h 12 min" · "12 min" · "Expirado" */
export function formatTimeLeft(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes <= 0) return "Expirado";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Pedidos EN CURSO: los que todavía tienen que pasar algo.
 *
 * Una sola definición, como `CONFIRMED_STATUSES`. La usa el retiro de
 * productos: no se puede sacar del catálogo algo que alguien está esperando
 * recibir — el operador se quedaría sin la ficha justo cuando tiene que
 * empacarlo, y el comprador con un pedido de un producto que ya no existe.
 *
 * `DELIVERED` y `CANCELLED` quedan fuera: ya no hay nada pendiente con ellos.
 */
export const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
];

/** Filtro de Prisma para pedidos en curso. */
export const inProgressFilter = { status: { in: IN_PROGRESS_STATUSES } } as const;
