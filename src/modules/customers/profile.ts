// Perfil del cliente: métricas y top de categorías.
// Ver openspec/changes/modulo-clientes — specs/customer-profile.

import { db } from "@/lib/db";
import { CONFIRMED_SQL_LIST, confirmedFilter } from "./confirmed";

type Db = typeof db;

export type CurrencyStat = { currency: string; orders: number; total: number; avg: number };

export type CustomerMetrics = {
  /** Total histórico de pedidos confirmados, sumando las dos monedas. */
  orders: number;
  /** Días desde el último pedido confirmado. `null` = nunca compró. */
  inactiveDays: number | null;
  /** Estadística de la moneda con más pedidos. `null` si no compró. */
  primary: CurrencyStat | null;
  /** Las otras monedas, cada una por separado. NUNCA se suman con la principal. */
  others: CurrencyStat[];
};

/**
 * Métricas del perfil.
 *
 * ⚠️ LAS DOS MONEDAS NUNCA SE SUMAN NI SE CONVIERTEN. No existe tasa de cambio
 * en KORA y es deliberado: cada divisa usa su propio precio cargado. Un ticket
 * promedio que mezclara pesos y dólares sería un número sin significado que
 * además **parecería correcto**, que es lo peligroso.
 */
export async function customerMetrics(
  customerId: string,
  client: Db = db,
): Promise<CustomerMetrics> {
  const [porMoneda, ultimo] = await Promise.all([
    client.order.groupBy({
      by: ["currency"],
      where: { customerId, ...confirmedFilter },
      _count: { _all: true },
      _sum: { total: true },
    }),
    client.order.findFirst({
      where: { customerId, ...confirmedFilter },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const stats: CurrencyStat[] = porMoneda
    .map((g) => {
      const orders = g._count._all;
      const total = Number(g._sum.total ?? 0);
      return { currency: g.currency, orders, total, avg: orders > 0 ? total / orders : 0 };
    })
    // Predominante = más pedidos; a igualdad de pedidos, mayor gasto (mismo
    // criterio de desempate que el top de categorías, para no inventar dos).
    .sort((a, b) => b.orders - a.orders || b.total - a.total);

  return {
    orders: stats.reduce((n, s) => n + s.orders, 0),
    inactiveDays: ultimo
      ? Math.floor((Date.now() - ultimo.createdAt.getTime()) / 86_400_000)
      : null,
    primary: stats[0] ?? null,
    others: stats.slice(1),
  };
}

export type TopCategory = {
  categoryId: string;
  categoryName: string;
  units: number;
  spent: number;
};

/**
 * Top cinco de categorías más compradas.
 *
 * En SQL directo y agregado en la base: la alternativa sería traer todas las
 * líneas de todos los pedidos del cliente para agruparlas en memoria, que es
 * justo lo que la historia de usuario prohíbe al exigir consultas agregadas.
 *
 * Empate en unidades → gana el de mayor gasto.
 */
export async function topCategories(
  customerId: string,
  limit = 5,
  client: Db = db,
): Promise<TopCategory[]> {
  const filas = await client.$queryRawUnsafe<
    { categoryId: string; categoryName: string; units: bigint; spent: string }[]
  >(
    `SELECT c.id            AS "categoryId",
            c.name          AS "categoryName",
            SUM(oi.qty)              AS units,
            SUM(oi.qty * oi."unitPrice") AS spent
     FROM order_items oi
     JOIN orders o     ON o.id = oi."orderId"
     JOIN variants v   ON v.id = oi."variantId"
     JOIN products p   ON p.id = v."productId"
     JOIN categories c ON c.id = p."categoryId"
     WHERE o."customerId" = $1
       AND o.status IN (${CONFIRMED_SQL_LIST})
     GROUP BY c.id, c.name
     ORDER BY units DESC, spent DESC
     LIMIT ${limit}`,
    customerId,
  );

  return filas.map((f) => ({
    categoryId: f.categoryId,
    categoryName: f.categoryName,
    units: Number(f.units),
    spent: Number(f.spent),
  }));
}

/**
 * Enlace de contacto por WhatsApp.
 *
 * ⚠️ `api.whatsapp.com/send`, NUNCA `wa.me`. La historia de usuario CLI_HU002
 * especifica `wa.me` y está equivocada: su redirección re-codifica el texto y
 * rompe los caracteres de 4 bytes — el emoji del saludo del mensaje de pedido
 * llegaba partido. Ya costó encontrarlo una vez en el flujo de pedidos.
 *
 * Si alguien "corrige" esto leyendo la HU, el error vuelve.
 */
export function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const digitos = phone.replace(/\D/g, "");
  if (digitos.length < 7) return null;
  return `https://api.whatsapp.com/send?phone=${digitos}`;
}
