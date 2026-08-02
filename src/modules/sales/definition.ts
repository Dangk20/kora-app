// Qué es una venta, en UN solo sitio.
// Ver openspec/changes/modulo-ventas — specs/sales-reporting.
//
// Una venta es un pedido que LLEGÓ A CONFIRMARSE. Un pedido pendiente todavía
// no vendió nada; uno cancelado dejó de venderlo; uno entregado sigue siendo
// una venta.
//
// Este módulo NO escribe su propio filtro: reutiliza `CONFIRMED_STATUSES`, que
// ya es la definición del proyecto. Si escribiera la suya, bastaría con que una
// de las dos olvidara excluir los cancelados para que el total de ventas y el
// del dashboard SE CONTRADIJERAN — y ninguna de las dos cifras parecería
// equivocada. Ese error solo se descubre comparándolas, que suele pasar
// delante del cliente.

import type { Currency, SaleChannel } from "@/generated/prisma/enums";
import { CONFIRMED_STATUSES, confirmedFilter } from "@/modules/customers/confirmed";

export { CONFIRMED_STATUSES, confirmedFilter };

/**
 * Filtro base de toda consulta de ventas.
 *
 * Exige `confirmedAt`: la fecha de una venta es la de su CONFIRMACIÓN, no la de
 * creación del pedido. El pedido se arma cuando el comprador quiere y se
 * confirma cuando el operador cobra; fechar por creación metería dinero en un
 * mes en el que no entró y el cierre dejaría de cuadrar con la caja.
 *
 * Un pedido confirmado sin `confirmedAt` es un dato roto, no un caso de
 * negocio: queda fuera en vez de inventarle una fecha.
 */
export const saleFilter = {
  ...confirmedFilter,
  confirmedAt: { not: null },
} as const;

/** Lista para SQL directo. */
export const SALE_SQL_STATUS = CONFIRMED_STATUSES.map((s) => `'${s}'`).join(", ");

export type SalesFilters = {
  from?: Date;
  to?: Date;
  channel?: SaleChannel;
  currency?: Currency;
};

/** El periodo por defecto: el mes en curso. Se dice en pantalla, no se adivina. */
export function currentMonth(now: Date = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/**
 * Tope de lo que se puede exportar de una vez.
 *
 * Se dice en pantalla en lugar de fallar en silencio con un archivo a medias:
 * un CSV truncado sin avisar es peor que un mensaje que pide acotar el rango.
 */
export const EXPORT_MAX_ROWS = 5_000;

/** El filtro de Prisma que corresponde a unos filtros de pantalla. */
export function whereFrom(filters: SalesFilters) {
  const rango =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        }
      : undefined;

  return {
    status: { in: CONFIRMED_STATUSES },
    // `not: null` va SIEMPRE, con o sin rango: sin él, un pedido confirmado con
    // la fecha perdida entraría en los totales sin poder ubicarse en el tiempo.
    confirmedAt: rango ? { ...rango, not: null } : { not: null },
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
  };
}
