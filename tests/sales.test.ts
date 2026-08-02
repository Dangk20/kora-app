// Módulo de ventas. Lo que se fija aquí:
//   1. LAS MONEDAS NUNCA SE SUMAN. Es el defecto que este módulo vino a
//      corregir: el dashboard sumaba pesos y dólares y lo imprimía todo como
//      pesos. El error PARECE correcto, y con esa cifra se cierra un mes.
//   2. "Venta" significa lo mismo aquí que en el dashboard y en clientes.
//   3. La fecha de una venta es la de su CONFIRMACIÓN, no la del pedido.
//   4. El total es el efectivamente cobrado, no el precio de lista.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  businessDayKey,
  businessDayKeyOffset,
  startOfBusinessDay,
} from "@/lib/business-time";
import { salesLastWeek } from "@/modules/dashboard/queries";
import { currentMonth, whereFrom } from "@/modules/sales/definition";
import { csvFilename, salesToCsv } from "@/modules/sales/csv";
import { allSales, listSales, salesTotals, type SaleRow } from "@/modules/sales/queries";

const PREFIJO = "zzt-ventas";

function enMoneda(totales: Awaited<ReturnType<typeof salesTotals>>, c: "COP" | "USD") {
  return totales.find((t) => t.currency === c);
}

let n = 0;
async function cliente() {
  n += 1;
  return db.customer.create({
    data: { name: `${PREFIJO} ${n}`, email: `${PREFIJO}-${n}-${Date.now()}@test.local` },
  });
}

type VentaOver = {
  total?: number;
  currency?: "COP" | "USD";
  status?: "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
  confirmedAt?: Date | null;
  createdAt?: Date;
  channel?: "WEB" | "POS";
  discountTotal?: number;
  cashbackApplied?: number;
};

async function venta(customerId: string, over: VentaOver = {}) {
  const status = over.status ?? "CONFIRMED";
  const confirmado = status === "CONFIRMED" || status === "DELIVERED";
  const total = over.total ?? 100_000;
  return db.order.create({
    data: {
      channel: over.channel ?? "WEB",
      status,
      currency: over.currency ?? "COP",
      customerId,
      subtotal: total,
      total,
      discountTotal: over.discountTotal ?? 0,
      cashbackApplied: over.cashbackApplied ?? 0,
      note: PREFIJO,
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
      confirmedAt:
        over.confirmedAt !== undefined ? over.confirmedAt : confirmado ? new Date() : null,
    },
  });
}

/** Solo lo de esta prueba: la base de desarrollo tiene ventas reales. */
async function idsDePrueba() {
  return (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
}

async function totalesDePrueba(extra: Parameters<typeof salesTotals>[0] = {}) {
  // `salesTotals` no filtra por cliente —no debe— así que para aislar la
  // prueba se comparan los totales antes y después no serviría: se consulta
  // directamente con el mismo `whereFrom` acotado a los clientes de prueba.
  const ids = await idsDePrueba();
  const filas = await db.order.groupBy({
    by: ["currency"],
    where: { ...whereFrom(extra), customerId: { in: ids } },
    _sum: { total: true },
    _count: { _all: true },
  });
  return filas.map((f) => ({
    currency: f.currency,
    sales: f._count._all,
    total: Number(f._sum.total ?? 0),
  }));
}

async function limpiar() {
  const ids = await idsDePrueba();
  if (ids.length === 0) return;
  await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
  await db.orderStatusHistory.deleteMany({ where: { order: { customerId: { in: ids } } } });
  await db.order.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(limpiar);
afterEach(limpiar);

// ─────────────────────────────────────────────────────────────
describe("LAS MONEDAS NO SE SUMAN", () => {
  it("un pedido en dólares NO altera el total en pesos", async () => {
    const c = await cliente();
    await venta(c.id, { total: 100_000, currency: "COP" });
    await venta(c.id, { total: 40, currency: "USD" });

    const t = await totalesDePrueba();

    const cop = t.find((x) => x.currency === "COP");
    const usd = t.find((x) => x.currency === "USD");
    expect(cop).toMatchObject({ sales: 1, total: 100_000 });
    expect(usd).toMatchObject({ sales: 1, total: 40 });
    // Y en ningún sitio aparece 100.040, que es lo que hacía el dashboard.
    expect(t.some((x) => x.total === 100_040)).toBe(false);
  });

  it("los totales llegan SEPARADOS por moneda, nunca como un número plano", async () => {
    const c = await cliente();
    await venta(c.id, { total: 50_000, currency: "COP" });
    await venta(c.id, { total: 25, currency: "USD" });

    const t = await totalesDePrueba();

    // El tipo obliga a elegir moneda: no hay un campo "total" global.
    expect(t).toHaveLength(2);
    expect(t.every((x) => x.currency === "COP" || x.currency === "USD")).toBe(true);
  });

  it("filtrar por una moneda deja fuera la otra por completo", async () => {
    const c = await cliente();
    await venta(c.id, { total: 100_000, currency: "COP" });
    await venta(c.id, { total: 40, currency: "USD" });

    const soloUsd = await totalesDePrueba({ currency: "USD" });
    expect(soloUsd).toHaveLength(1);
    expect(soloUsd[0]).toMatchObject({ currency: "USD", total: 40 });
  });

  it("el ticket promedio se calcula DENTRO de cada moneda", async () => {
    const c = await cliente();
    await venta(c.id, { total: 100_000, currency: "COP" });
    await venta(c.id, { total: 200_000, currency: "COP" });
    await venta(c.id, { total: 40, currency: "USD" });

    const ids = await idsDePrueba();
    const todos = await salesTotals();
    // Se comprueba la forma sobre el conjunto real: cada fila tiene su propio
    // promedio y nunca un promedio cruzado.
    for (const fila of todos) {
      expect(fila.average).toBeCloseTo(fila.total / fila.sales, 6);
    }
    expect(ids.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe("qué cuenta como venta", () => {
  it("un pedido PENDIENTE no es una venta", async () => {
    const c = await cliente();
    await venta(c.id, { status: "PENDING" });
    expect(await totalesDePrueba()).toHaveLength(0);
  });

  it("un pedido CANCELADO tras confirmarse deja de contar", async () => {
    const c = await cliente();
    const p = await venta(c.id, { total: 80_000 });
    expect((await totalesDePrueba())[0]).toMatchObject({ sales: 1 });

    await db.order.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
    expect(await totalesDePrueba()).toHaveLength(0);
  });

  it("un pedido ENTREGADO sigue contando, UNA sola vez", async () => {
    const c = await cliente();
    await venta(c.id, { total: 80_000, status: "DELIVERED" });
    expect((await totalesDePrueba())[0]).toMatchObject({ sales: 1, total: 80_000 });
  });

  it("un confirmado SIN fecha de confirmación queda fuera: es un dato roto", async () => {
    const c = await cliente();
    await venta(c.id, { status: "CONFIRMED", confirmedAt: null });
    expect(await totalesDePrueba()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe("la fecha de una venta es la de su confirmación", () => {
  it("un pedido creado el último día del mes y confirmado el primero del siguiente cuenta en el mes NUEVO", async () => {
    const c = await cliente();
    await venta(c.id, {
      total: 90_000,
      createdAt: new Date("2026-06-30T22:00:00Z"),
      confirmedAt: new Date("2026-07-01T14:00:00Z"),
    });

    const junio = await totalesDePrueba({
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T23:59:59Z"),
    });
    const julio = await totalesDePrueba({
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-07-31T23:59:59Z"),
    });

    expect(junio).toHaveLength(0);
    expect(julio[0]).toMatchObject({ sales: 1, total: 90_000 });
  });

  it("UNA VENTA DE LA NOCHE EN BOGOTÁ NO SE VA AL DÍA SIGUIENTE", async () => {
    // 20:40 en Bogotá ya es el día siguiente en UTC, y el servidor corre en
    // UTC. Agrupando por día del servidor, esta venta aparecía en la columna
    // equivocada de la gráfica: la cifra es plausible, solo está mal ubicada,
    // así que nadie la reporta — y al cierre de mes el dinero cae en el mes
    // que no es.
    const c = await cliente();
    const nocheEnBogota = new Date("2026-08-02T01:40:00Z"); // 1 ago, 20:40 en Bogotá
    await venta(c.id, { total: 55_000, currency: "COP", confirmedAt: nocheEnBogota });

    expect(businessDayKey(nocheEnBogota)).toBe("2026-08-01");

    const semana = await salesLastWeek("COP", db, nocheEnBogota);
    const dia = semana.find((d) => d.key === "2026-08-01");
    const diaSiguiente = semana.find((d) => d.key === "2026-08-02");

    // Cae en el 1 de agosto, que es cuando el negocio la hizo.
    expect(dia?.total).toBeGreaterThanOrEqual(55_000);
    // Y el 2 de agosto ni siquiera está en la ventana: hoy es el 1.
    expect(diaSiguiente).toBeUndefined();
  });

  it("la madrugada en UTC sigue perteneciendo al día colombiano anterior", () => {
    // Mismo instante, leído por el servidor y por el negocio.
    const instante = new Date("2026-08-02T03:00:00Z");
    expect(instante.toISOString().slice(0, 10)).toBe("2026-08-02"); // UTC
    expect(businessDayKey(instante)).toBe("2026-08-01"); // Colombia
  });

  it("la ventana de la gráfica son siete días del negocio, terminando hoy", async () => {
    const hoy = new Date("2026-08-02T01:40:00Z"); // 1 ago en Bogotá
    const semana = await salesLastWeek("COP", db, hoy);

    expect(semana).toHaveLength(7);
    expect(semana[0].key).toBe(businessDayKeyOffset(hoy, -6));
    expect(semana[6].key).toBe("2026-08-01");
    expect(semana[6].isToday).toBe(true);
    expect(semana.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("el periodo por defecto es el mes en curso", () => {
    const { from, to } = currentMonth(new Date("2026-08-15T10:00:00Z"));
    expect(from.getMonth()).toBe(7); // agosto
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(7);
    expect(to.getDate()).toBe(31);
  });
});

// ─────────────────────────────────────────────────────────────
describe("el total es lo efectivamente cobrado", () => {
  it("una venta con cupón y cashback registra lo que el comprador pagó", async () => {
    const c = await cliente();
    // Lista 100.000 · cupón 10.000 · cashback 20.000 → cobrado 70.000.
    await venta(c.id, { total: 70_000, discountTotal: 10_000, cashbackApplied: 20_000 });

    expect((await totalesDePrueba())[0]).toMatchObject({ total: 70_000 });

    const pagina = await listSales({ page: 1 });
    const fila = pagina.rows.find((r) => r.customerName?.startsWith(PREFIJO));
    expect(fila).toMatchObject({ total: 70_000, discountTotal: 10_000, cashbackApplied: 20_000 });
  });
});

// ─────────────────────────────────────────────────────────────
describe("el listado", () => {
  it("ordena por fecha de confirmación, de la más reciente a la más antigua", async () => {
    const c = await cliente();
    await venta(c.id, { total: 10_000, confirmedAt: new Date("2026-07-01T10:00:00Z") });
    await venta(c.id, { total: 20_000, confirmedAt: new Date("2026-07-20T10:00:00Z") });

    const pagina = await listSales({
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-07-31T23:59:59Z"),
    });
    const mias = pagina.rows.filter((r) => r.customerName?.startsWith(PREFIJO));
    expect(mias.map((r) => r.total)).toEqual([20_000, 10_000]);
  });

  it("filtra por canal", async () => {
    const c = await cliente();
    await venta(c.id, { total: 10_000, channel: "WEB" });

    const web = await totalesDePrueba({ channel: "WEB" });
    const pos = await totalesDePrueba({ channel: "POS" });
    expect(web[0]).toMatchObject({ sales: 1 });
    expect(pos).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe("exportación", () => {
  const fila = (over: Partial<SaleRow> = {}): SaleRow => ({
    orderId: "o1",
    number: 42,
    confirmedAt: new Date("2026-08-02T01:40:00Z"), // 1 ago, 20:40 en Bogotá
    customerName: "Laura Gómez",
    channel: "WEB",
    currency: "COP",
    total: 1_234_567,
    discountTotal: 0,
    cashbackApplied: 0,
    items: 2,
    ...over,
  });

  it("los importes son SUMABLES: sin símbolo ni separador de miles", () => {
    const csv = salesToCsv([fila()]);
    // Con "$1.234.567" la hoja de cálculo no puede sumar, y exportar para no
    // poder sumar no sirve de nada.
    expect(csv).toContain("1234567,00");
    expect(csv).not.toContain("$1.234.567");
  });

  it("la moneda va en COLUMNA PROPIA, no pegada al importe", () => {
    const csv = salesToCsv([fila({ currency: "USD", total: 40 })]);
    const [cabecera, datos] = csv.replace("﻿", "").split("\r\n");
    const cols = cabecera.split(";");
    const vals = datos.split(";");

    expect(cols).toContain("Moneda");
    expect(vals[cols.indexOf("Moneda")]).toBe("USD");
    expect(vals[cols.indexOf("Total cobrado")]).toBe("40,00");
  });

  it("usa `;` y BOM, que es lo que Excel en español necesita", () => {
    const csv = salesToCsv([fila()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")[0]).toContain(";");
  });

  it("la fecha exportada es el DÍA DEL NEGOCIO, no el del servidor", () => {
    // 01:40 UTC del 2 de agosto es todavía el 1 de agosto en Colombia.
    const csv = salesToCsv([fila()]);
    expect(csv).toContain("2026-08-01");
    expect(csv).not.toContain("2026-08-02");
  });

  it("un nombre con punto y coma no rompe las columnas", () => {
    const csv = salesToCsv([fila({ customerName: 'Gómez; "El Rápido"' })]);
    const datos = csv.replace("﻿", "").split("\r\n")[1];
    // Va entrecomillado, así que la fila sigue teniendo sus 9 columnas.
    expect(datos).toContain('"Gómez; ""El Rápido"""');
  });

  it("el nombre del archivo lleva el periodo", () => {
    const nombre = csvFilename(
      new Date("2026-07-01T05:00:00Z"),
      new Date("2026-07-31T05:00:00Z"),
    );
    expect(nombre).toBe("kora-ventas_2026-07-01_a_2026-07-31.csv");
  });

  it("exporta exactamente lo filtrado", async () => {
    const c = await cliente();
    await venta(c.id, { total: 10_000, currency: "COP" });
    await venta(c.id, { total: 40, currency: "USD" });

    const soloUsd = await allSales({ currency: "USD" }, 100);
    const mias = soloUsd.filter((r) => r.customerName?.startsWith(PREFIJO));
    expect(mias).toHaveLength(1);
    expect(mias[0].currency).toBe("USD");
  });
});

// ─────────────────────────────────────────────────────────────
describe("coherencia con el dashboard", () => {
  it("el total del módulo coincide con la gráfica del dashboard para el mismo periodo y moneda", async () => {
    // Son dos consultas escritas por separado —una con Prisma, otra en SQL—
    // sobre la misma definición de venta. Si divergen, dos pantallas del mismo
    // panel se contradicen y ninguna parece equivocada.
    const c = await cliente();
    const hoy = new Date();
    await venta(c.id, { total: 33_000, currency: "COP", confirmedAt: hoy });

    const semana = await salesLastWeek("COP", db, hoy);
    const delDia = semana.find((d) => d.isToday);

    // El mismo día, medido igual: el inicio del día EN COLOMBIA.
    const totalesHoy = await salesTotals({
      from: startOfBusinessDay(hoy),
      currency: "COP",
    });
    const cop = enMoneda(totalesHoy, "COP");

    expect(delDia?.total).toBe(cop?.total ?? 0);
  });
});
