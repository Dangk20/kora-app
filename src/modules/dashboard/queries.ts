// Consultas del dashboard.
// Ver openspec/changes/dashboard-datos-reales.
//
// Reutiliza el predicado de "pedido confirmado" del módulo de clientes en vez
// de escribir otro filtro: dos definiciones de venta en el mismo panel es cómo
// aparecen dos números distintos para la misma cosa, y ambos parecen
// razonables.

import { db } from "@/lib/db";
import { CONFIRMED_SQL_LIST } from "@/modules/customers/confirmed";

type Db = typeof db;

export type DaySales = { date: Date; label: string; total: number };

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Ventas de los últimos siete días, un elemento por día.
 *
 * Se devuelven SIEMPRE los siete, rellenando con cero los que no tuvieron
 * ventas. Si se pintaran solo los días con datos, una semana con dos ventas
 * mostraría dos barras y el operador leería una semana de dos días.
 */
export async function salesLastWeek(
  currency = "COP",
  client: Db = db,
  now: Date = new Date(),
): Promise<DaySales[]> {
  const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const filas = await client.$queryRawUnsafe<{ dia: Date; total: string }[]>(
    `SELECT date_trunc('day', "confirmedAt") AS dia, SUM(total) AS total
     FROM orders
     WHERE status IN (${CONFIRMED_SQL_LIST})
       AND currency = $1
       AND "confirmedAt" >= $2
     GROUP BY dia`,
    currency,
    desde,
  );

  const porDia = new Map(
    filas.map((f) => [new Date(f.dia).toDateString(), Number(f.total)]),
  );

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
    return {
      date: d,
      label: DIAS_CORTOS[d.getDay()],
      total: porDia.get(d.toDateString()) ?? 0,
    };
  });
}

export type TopProduct = {
  productId: string;
  name: string;
  categoryColor: string;
  categoryIcon: string;
  units: number;
  revenue: number;
};

/**
 * Top de productos por unidades REALMENTE vendidas.
 *
 * Antes se ordenaba por "destacado" y fecha de creación — es decir, no era un
 * top de nada: le devolvía al operador lo que él mismo había marcado. Destacado
 * es una decisión suya, no un dato.
 */
export async function topProducts(limit = 5, client: Db = db): Promise<TopProduct[]> {
  const filas = await client.$queryRawUnsafe<
    {
      productId: string;
      name: string;
      categoryColor: string;
      categoryIcon: string;
      units: bigint;
      revenue: string;
    }[]
  >(
    `SELECT p.id AS "productId",
            p.name,
            c.color AS "categoryColor",
            c.icon  AS "categoryIcon",
            SUM(oi.qty) AS units,
            SUM(oi.total) AS revenue
     FROM order_items oi
     JOIN orders o     ON o.id = oi."orderId"
     JOIN variants v   ON v.id = oi."variantId"
     JOIN products p   ON p.id = v."productId"
     JOIN categories c ON c.id = p."categoryId"
     WHERE o.status IN (${CONFIRMED_SQL_LIST})
     GROUP BY p.id, p.name, c.color, c.icon
     ORDER BY units DESC, revenue DESC
     LIMIT ${limit}`,
  );

  return filas.map((f) => ({
    productId: f.productId,
    name: f.name,
    categoryColor: f.categoryColor,
    categoryIcon: f.categoryIcon,
    units: Number(f.units),
    revenue: Number(f.revenue),
  }));
}
