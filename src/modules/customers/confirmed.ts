// Qué cuenta como "pedido confirmado", en UN solo sitio.
// Ver openspec/changes/modulo-clientes — design.md decisión 3.
//
// Hay seis lugares del módulo que filtran por pedidos confirmados. Si cada uno
// escribiera su propio filtro, bastaría con que uno olvidara excluir los
// cancelados para que el ticket promedio y el total de pedidos DISCREPARAN
// entre la tarjeta y el perfil — y ese es justo el error que nadie reporta,
// porque los dos números parecen razonables.

import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Un pedido cuenta si LLEGÓ a confirmarse, incluidos los que avanzaron
 * después: un pedido entregado sigue siendo una venta. Solo quedan fuera los
 * pendientes (que aún no son venta) y los cancelados (que dejaron de serlo).
 */
export const CONFIRMED_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

/** Filtro de Prisma para pedidos confirmados. */
export const confirmedFilter = { status: { in: CONFIRMED_STATUSES } } as const;

/** Lista para SQL directo: `status IN (...)`. */
export const CONFIRMED_SQL_LIST = CONFIRMED_STATUSES.map((s) => `'${s}'`).join(", ");

/** Ventana de actividad reciente que usan las tarjetas de resumen. */
export const ACTIVITY_WINDOW_DAYS = 30;

export function windowStart(days = ACTIVITY_WINDOW_DAYS, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60_000);
}
