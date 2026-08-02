// Consultas del dashboard.
// Ver openspec/changes/dashboard-datos-reales.
//
// Reutiliza el predicado de "pedido confirmado" del módulo de clientes en vez
// de escribir otro filtro: dos definiciones de venta en el mismo panel es cómo
// aparecen dos números distintos para la misma cosa, y ambos parecen
// razonables.

import { db } from "@/lib/db";
import {
  businessDayKey,
  businessDayKeyOffset,
  businessDayLabel,
  businessDayStart,
  sqlBusinessDay,
} from "@/lib/business-time";
import { CONFIRMED_SQL_LIST } from "@/modules/customers/confirmed";

type Db = typeof db;

export type DaySales = {
  /** Día del negocio, `YYYY-MM-DD`. No un Date: un Date invita a compararlo
   *  con la fecha del servidor, que corre en UTC y parte el día por otro
   *  sitio. */
  key: string;
  label: string;
  total: number;
  isToday: boolean;
};

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
  // Los siete días del negocio, no del servidor. Agrupar en UTC ponía las
  // ventas de la mañana en el día anterior: el error no se ve, solo mueve el
  // dinero de columna.
  const dias = Array.from({ length: 7 }, (_, i) => businessDayKeyOffset(now, i - 6));
  const hoy = businessDayKey(now);

  const filas = await client.$queryRawUnsafe<{ dia: string; total: string }[]>(
    `SELECT ${sqlBusinessDay('"confirmedAt"')} AS dia,
            SUM(total) AS total
     FROM orders
     WHERE status IN (${CONFIRMED_SQL_LIST})
       AND currency = $1
       AND "confirmedAt" >= $2
     GROUP BY dia`,
    currency,
    // El instante en que empezó ese día EN COLOMBIA, ya en UTC como la columna.
    businessDayStart(dias[0]),
  );

  const porDia = new Map(filas.map((f) => [f.dia, Number(f.total)]));

  // Se devuelven SIEMPRE los siete, con cero donde no hubo ventas: pintar solo
  // los días con datos haría que una semana de dos ventas se leyera como una
  // semana de dos días.
  return dias.map((key) => ({
    key,
    label: businessDayLabel(key),
    total: porDia.get(key) ?? 0,
    isToday: key === hoy,
  }));
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
export async function topProducts(
  currency = "COP",
  limit = 5,
  client: Db = db,
): Promise<TopProduct[]> {
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
       -- Sin este filtro, la columna de ingresos sumaba pesos y dólares en el
       -- mismo número. Las unidades sí se pueden sumar entre monedas —una
       -- unidad es una unidad— pero el dinero no: no existe tasa de cambio en
       -- KORA y es deliberado.
       AND o.currency = $1
     GROUP BY p.id, p.name, c.color, c.icon
     ORDER BY units DESC, revenue DESC
     LIMIT $2`,
    currency,
    limit,
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
