// Consultas del módulo de clientes: resumen y listado.
// Ver openspec/changes/modulo-clientes — specs/customer-directory.
//
// Todo se resuelve EN LA BASE. La alternativa —traer los pedidos de cada
// cliente y sumarlos en la aplicación— funciona con veinte clientes de prueba
// y deja de cargar con dos mil. La historia de usuario exige explícitamente que
// la vista aguante miles, y eso solo se cumple por construcción.

import { db } from "@/lib/db";
import { CONFIRMED_SQL_LIST, confirmedFilter, windowStart } from "./confirmed";

type Db = typeof db;

export type CustomerSummary = {
  nuevos: number;
  activos: number;
  total: number;
  conCuenta: number;
};

/**
 * Las cuatro tarjetas del encabezado.
 *
 * "Activo" significa **compró y esa compra se confirmó**: un pedido pendiente o
 * cancelado no vuelve activo a nadie. Si lo hiciera, la tarjeta contaría
 * intenciones en vez de ventas y el operador haría remarketing sobre gente que
 * nunca compró.
 */
export async function customerSummary(client: Db = db): Promise<CustomerSummary> {
  const desde = windowStart();

  const [total, nuevos, activos] = await Promise.all([
    client.customer.count(),
    client.customer.count({ where: { createdAt: { gte: desde } } }),
    client.customer.count({
      where: { orders: { some: { ...confirmedFilter, createdAt: { gte: desde } } } },
    }),
  ]);

  // "Clientes con cuenta" mide la adopción del registro opcional frente a los
  // compradores invitados. La cuenta del comprador (módulo ACC) todavía no
  // existe —"Mi cuenta" dice "Próximamente"— así que hoy es necesariamente 0.
  // Es la misma regla que el saldo de fidelización: mostrar cero sin error en
  // vez de ocultar la tarjeta, para que el hueco quede visible y listo.
  const conCuenta = 0;

  return { total, nuevos, activos, conCuenta };
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string;
  /** Días de la semana (0 = domingo … 6 = sábado) con más pedidos confirmados. */
  topWeekdays: number[];
};

export type CustomerPage = {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const PAGE_SIZE = 20;

/**
 * Normaliza un término de búsqueda de teléfono.
 *
 * Sin esto, buscar "320 827 0414" no encontraría a quien está guardado como
 * "+573208270414": para la base son cadenas distintas. Se comparan solo los
 * dígitos, así el mismo número se encuentra se escriba como se escriba.
 */
function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export async function listCustomers(
  { search = "", page = 1, pageSize = PAGE_SIZE }: { search?: string; page?: number; pageSize?: number },
  client: Db = db,
): Promise<CustomerPage> {
  const q = search.trim();
  const digitos = soloDigitos(q);

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          // El teléfono se busca por dígitos para que dé igual el formato.
          ...(digitos.length >= 3 ? [{ phone: { contains: digitos } }] : []),
        ],
      }
    : {};

  const [total, clientes] = await Promise.all([
    client.customer.count({ where }),
    client.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, phone: true, email: true, country: true },
    }),
  ]);

  const topWeekdays = await weekdaysByCustomer(clientes.map((c) => c.id), client);

  return {
    rows: clientes.map((c) => ({ ...c, topWeekdays: topWeekdays.get(c.id) ?? [] })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Días de la semana con más pedidos confirmados, por cliente.
 *
 * En SQL directo porque Prisma no sabe agrupar por día de la semana. Una
 * consulta para toda la página, no una por cliente: veinte consultas por carga
 * es exactamente la clase de detalle que hace lenta una lista.
 */
async function weekdaysByCustomer(
  ids: string[],
  client: Db = db,
): Promise<Map<string, number[]>> {
  const resultado = new Map<string, number[]>();
  if (ids.length === 0) return resultado;

  const filas = await client.$queryRawUnsafe<
    { customerId: string; dow: number; n: bigint }[]
  >(
    `SELECT "customerId", EXTRACT(DOW FROM "createdAt")::int AS dow, COUNT(*) AS n
     FROM orders
     WHERE "customerId" = ANY($1)
       AND status IN (${CONFIRMED_SQL_LIST})
     GROUP BY "customerId", dow`,
    ids,
  );

  // Se resaltan los días que empatan en el máximo: si alguien compra siempre
  // sábados y domingos por igual, ocultar uno de los dos sería mentir.
  const porCliente = new Map<string, { dow: number; n: number }[]>();
  for (const f of filas) {
    const lista = porCliente.get(f.customerId) ?? [];
    lista.push({ dow: f.dow, n: Number(f.n) });
    porCliente.set(f.customerId, lista);
  }
  for (const [id, lista] of porCliente) {
    const max = Math.max(...lista.map((x) => x.n));
    resultado.set(id, lista.filter((x) => x.n === max).map((x) => x.dow).sort());
  }
  return resultado;
}
