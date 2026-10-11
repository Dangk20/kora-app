// Consultas del módulo de clientes: resumen y listado.
// Ver openspec/changes/modulo-clientes — specs/customer-directory.
//
// Todo se resuelve EN LA BASE. La alternativa —traer los pedidos de cada
// cliente y sumarlos en la aplicación— funciona con veinte clientes de prueba
// y deja de cargar con dos mil. La historia de usuario exige explícitamente que
// la vista aguante miles, y eso solo se cumple por construcción.

import { db } from "@/lib/db";
import { CONFIRMED_SQL_LIST, confirmedFilter, windowStart } from "./confirmed";
import {
  esClienteWhere,
  etiquetaDe,
  whereEtiqueta,
  type Etiqueta,
  type FiltroEtiqueta,
} from "./etiqueta";

type Db = typeof db;

export type CustomerSummary = {
  nuevos: number;
  activos: number;
  /** Personas en la base: registradas, compradoras invitadas y creadas a mano. */
  total: number;
  /** Con al menos un pedido confirmado. clientes + noClientes = total. */
  clientes: number;
  noClientes: number;
  /** Registrados en la web: crearon cuenta de acceso en la tienda. */
  conCuenta: number;
};

/**
 * Las tarjetas del encabezado.
 *
 * "Activo" significa **compró y esa compra se confirmó**: un pedido pendiente o
 * cancelado no vuelve activo a nadie. Si lo hiciera, la tarjeta contaría
 * intenciones en vez de ventas y el operador haría remarketing sobre gente que
 * nunca compró.
 */
export async function customerSummary(client: Db = db): Promise<CustomerSummary> {
  const desde = windowStart();

  // "Registrados en la web" estuvo fijo en 0 desde que se escribió esta
  // función, cuando la cuenta del comprador no existía; nadie lo conectó al
  // construirla, y ese cero era justo el "no sabemos cuántos se registraron".
  // La cuenta es la contraseña en la fila del cliente (cuenta-comprador).
  const [total, nuevos, activos, clientes, conCuenta] = await Promise.all([
    client.customer.count(),
    client.customer.count({ where: { createdAt: { gte: desde } } }),
    client.customer.count({
      where: { orders: { some: { ...confirmedFilter, createdAt: { gte: desde } } } },
    }),
    client.customer.count({ where: esClienteWhere }),
    client.customer.count({ where: { passwordHash: { not: null } } }),
  ]);

  // No clientes se obtiene por diferencia y no con otra consulta: así la suma
  // cuadra por construcción, aunque entre dos conteos se confirme un pedido.
  return { total, nuevos, activos, clientes, noClientes: total - clientes, conCuenta };
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  country: string;
  /** Derivada de sus pedidos confirmados; ver etiqueta.ts. */
  etiqueta: Etiqueta;
  /** Creó cuenta en la tienda (si no, es invitada o se creó a mano). */
  tieneCuenta: boolean;
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
  {
    search = "",
    page = 1,
    pageSize = PAGE_SIZE,
    etiqueta = "todos",
  }: { search?: string; page?: number; pageSize?: number; etiqueta?: FiltroEtiqueta },
  client: Db = db,
): Promise<CustomerPage> {
  const q = search.trim();
  const digitos = soloDigitos(q);

  const busqueda = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          // El teléfono se busca por dígitos para que dé igual el formato.
          ...(digitos.length >= 3 ? [{ phone: { contains: digitos } }] : []),
        ],
      }
    : {};
  const where = { AND: [busqueda, whereEtiqueta(etiqueta)] };

  const [total, clientes] = await Promise.all([
    client.customer.count({ where }),
    client.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        country: true,
        // Solo para saber SI tiene cuenta; el hash no sale de esta función.
        passwordHash: true,
        // La etiqueta, en la misma consulta: un conteo filtrado por fila.
        _count: { select: { orders: { where: confirmedFilter } } },
      },
    }),
  ]);

  const topWeekdays = await weekdaysByCustomer(clientes.map((c) => c.id), client);

  return {
    rows: clientes.map(({ passwordHash, _count, ...c }) => ({
      ...c,
      etiqueta: etiquetaDe(_count.orders),
      tieneCuenta: passwordHash !== null,
      topWeekdays: topWeekdays.get(c.id) ?? [],
    })),
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
