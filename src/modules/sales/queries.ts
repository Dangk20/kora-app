// Consultas del módulo de ventas.
// Ver openspec/changes/modulo-ventas — specs/sales-reporting.
//
// Las ventas se DERIVAN del pedido; no hay tabla `sales`. Una tabla aparte
// sería una segunda copia de un dato que ya existe, con la obligación de
// mantenerla al día en cada confirmación, cancelación y avance de estado — y el
// día que se desincronizara, el módulo y el pedido dirían cosas distintas sobre
// el mismo dinero sin forma de saber cuál miente.

import type { Currency, SaleChannel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { aNumero } from "@/modules/cashback/money";
import { whereFrom, type SalesFilters } from "./definition";

export const PAGE_SIZE = 25;

/**
 * Totales de un periodo, UNA FILA POR MONEDA.
 *
 * Nunca devuelve un total plano, y es deliberado: si lo hiciera y la pantalla
 * separara las monedas, el primer sitio que reutilizara esta consulta sin
 * acordarse volvería a mezclarlas. Devolviéndolas ya separadas, **sumarlas
 * exige una decisión explícita** en vez de ser lo que pasa por omisión.
 *
 * No existe tasa de cambio en KORA y es a propósito: un total que mezclara
 * pesos y dólares sería un número sin significado que además parecería
 * correcto, y con él se cierra un mes.
 */
export type CurrencyTotals = {
  currency: Currency;
  sales: number;
  total: number;
  /** Ticket promedio de ESA moneda. */
  average: number;
};

export async function salesTotals(filters: SalesFilters = {}): Promise<CurrencyTotals[]> {
  const filas = await db.order.groupBy({
    by: ["currency"],
    where: whereFrom(filters),
    _sum: { total: true },
    _count: { _all: true },
  });

  return filas
    .map((f) => {
      const total = aNumero(f._sum.total ?? 0);
      const sales = f._count._all;
      return {
        currency: f.currency,
        sales,
        total,
        average: sales > 0 ? total / sales : 0,
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export type SaleRow = {
  orderId: string;
  number: number;
  confirmedAt: Date;
  customerName: string | null;
  channel: SaleChannel;
  currency: Currency;
  /** Lo EFECTIVAMENTE cobrado: el snapshot, ya con cupón y cashback restados. */
  total: number;
  discountTotal: number;
  cashbackApplied: number;
  items: number;
};

export type SalesPage = {
  rows: SaleRow[];
  total: number;
  page: number;
  totalPages: number;
};

export async function listSales(
  filters: SalesFilters & { page?: number; pageSize?: number } = {},
): Promise<SalesPage> {
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const where = whereFrom(filters);

  const [total, pedidos] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      // Por fecha de CONFIRMACIÓN, que es la fecha de la venta.
      orderBy: { confirmedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        confirmedAt: true,
        channel: true,
        currency: true,
        total: true,
        discountTotal: true,
        cashbackApplied: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    rows: pedidos.map((o) => ({
      orderId: o.id,
      number: o.number,
      // El filtro garantiza que no es nulo; el tipo de Prisma no lo sabe.
      confirmedAt: o.confirmedAt as Date,
      customerName: o.customer?.name ?? null,
      channel: o.channel,
      currency: o.currency,
      total: aNumero(o.total),
      discountTotal: aNumero(o.discountTotal),
      cashbackApplied: aNumero(o.cashbackApplied),
      items: o._count.items,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Todas las filas del filtro, sin paginar. Solo para exportar. */
export async function allSales(filters: SalesFilters, limit: number): Promise<SaleRow[]> {
  const page = await listSales({ ...filters, page: 1, pageSize: limit });
  return page.rows;
}

/** Cuántas ventas hay en el filtro, para avisar antes de exportar de más. */
export async function countSales(filters: SalesFilters = {}): Promise<number> {
  return db.order.count({ where: whereFrom(filters) });
}
