// Módulo de clientes. Lo crítico:
//   1. Todas las métricas cuentan SOLO pedidos confirmados. Una métrica
//      equivocada no se nota: un número plausible no levanta sospechas, y sobre
//      él se toman decisiones de remarketing.
//   2. Las dos monedas NUNCA se suman ni se convierten — no hay tasa de cambio
//      en KORA y es deliberado.
//   3. El teléfono es el identificador único, y se compara YA NORMALIZADO: si
//      no, el mismo número en otro formato entra como cliente distinto y, como
//      no se puede eliminar, el duplicado es permanente.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { CONFIRMED_STATUSES } from "@/modules/customers/confirmed";
import { digitsOf, isUsablePhone, toE164 } from "@/modules/customers/phone";
import { customerMetrics, topCategories, whatsappLink } from "@/modules/customers/profile";
import { customerSummary, listCustomers } from "@/modules/customers/queries";

const MARCA = "ZZTEST";

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  const pedidos = (
    await db.order.findMany({ where: { customerId: { in: ids } }, select: { id: true } })
  ).map((o) => o.id);
  await db.orderItem.deleteMany({ where: { orderId: { in: pedidos } } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: pedidos } } });
  await db.order.deleteMany({ where: { id: { in: pedidos } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

async function cliente(over: Record<string, unknown> = {}) {
  return db.customer.create({
    data: {
      name: `${MARCA} ${Math.random().toString(36).slice(2, 8)}`,
      phone: `+5730${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      country: "CO",
      ...over,
    },
  });
}

async function pedido(customerId: string, over: Record<string, unknown> = {}) {
  return db.order.create({
    data: {
      customerId,
      channel: "WEB",
      status: "CONFIRMED",
      currency: "COP",
      subtotal: 100,
      total: 100,
      ...over,
    },
  });
}

beforeEach(limpiar);
afterEach(limpiar);

describe("normalización del teléfono", () => {
  it("el mismo número en formatos distintos produce el mismo E.164", () => {
    // Sin esto, `320 827 0414` y `+573208270414` entrarían como dos clientes.
    const esperado = "+573208270414";
    expect(toE164("3208270414", "CO")).toBe(esperado);
    expect(toE164("320 827 0414", "CO")).toBe(esperado);
    expect(toE164("+57 320 827 0414", "CO")).toBe(esperado);
    expect(toE164("(320) 827-0414", "CO")).toBe(esperado);
  });

  it("respeta el indicativo de cada país", () => {
    expect(toE164("2125551234", "US")).toBe("+12125551234");
  });

  it("rechaza lo que no es un teléfono usable", () => {
    expect(isUsablePhone("+57123")).toBe(false);
    expect(isUsablePhone("+573208270414")).toBe(true);
  });

  it("extrae solo los dígitos para buscar", () => {
    expect(digitsOf("+57 (320) 827-0414")).toBe("573208270414");
  });
});

describe("qué cuenta como pedido confirmado", () => {
  it("un pedido que avanzó más allá de confirmado sigue contando", () => {
    // Un pedido entregado sigue siendo una venta.
    expect(CONFIRMED_STATUSES).toContain("DELIVERED");
    expect(CONFIRMED_STATUSES).toContain("SHIPPED");
    expect(CONFIRMED_STATUSES).toContain("PREPARING");
  });

  it("pendientes y cancelados NO cuentan", () => {
    expect(CONFIRMED_STATUSES).not.toContain("PENDING");
    expect(CONFIRMED_STATUSES).not.toContain("CANCELLED");
  });
});

describe("resumen de la base", () => {
  it("un pedido PENDIENTE no vuelve activo a nadie", async () => {
    // Si contara, la tarjeta mediría intenciones en vez de ventas y el operador
    // haría remarketing sobre gente que nunca compró.
    const antes = await customerSummary(db);
    const c = await cliente();
    await pedido(c.id, { status: "PENDING" });

    const despues = await customerSummary(db);
    expect(despues.total).toBe(antes.total + 1);
    expect(despues.activos).toBe(antes.activos);
  });

  it("un pedido CANCELADO tampoco", async () => {
    const antes = await customerSummary(db);
    const c = await cliente();
    await pedido(c.id, { status: "CANCELLED" });
    expect((await customerSummary(db)).activos).toBe(antes.activos);
  });

  it("un pedido confirmado reciente SÍ activa al cliente", async () => {
    const antes = await customerSummary(db);
    const c = await cliente();
    await pedido(c.id, { status: "CONFIRMED" });
    expect((await customerSummary(db)).activos).toBe(antes.activos + 1);
  });

  it("un cliente con muchos pedidos confirmados cuenta UNA vez como activo", async () => {
    const antes = await customerSummary(db);
    const c = await cliente();
    await pedido(c.id);
    await pedido(c.id);
    await pedido(c.id);
    expect((await customerSummary(db)).activos).toBe(antes.activos + 1);
  });
});

describe("métricas del perfil", () => {
  it("un cliente sin compras no rompe nada", async () => {
    const c = await cliente();
    const m = await customerMetrics(c.id, db);
    expect(m.orders).toBe(0);
    expect(m.inactiveDays).toBeNull();
    expect(m.primary).toBeNull(); // sin división por cero
  });

  it("no cuenta pendientes ni cancelados", async () => {
    const c = await cliente();
    await pedido(c.id, { status: "PENDING", total: 999 });
    await pedido(c.id, { status: "CANCELLED", total: 999 });
    const m = await customerMetrics(c.id, db);
    expect(m.orders).toBe(0);
  });

  it("el ticket promedio es el total confirmado entre los pedidos confirmados", async () => {
    const c = await cliente();
    await pedido(c.id, { total: 100 });
    await pedido(c.id, { total: 300 });
    const m = await customerMetrics(c.id, db);
    expect(m.orders).toBe(2);
    expect(m.primary?.avg).toBe(200);
  });

  it("NO suma monedas distintas: cada una va por separado", async () => {
    // Un ticket promedio que mezclara pesos y dólares sería un número sin
    // significado que además parecería correcto.
    const c = await cliente();
    await pedido(c.id, { currency: "COP", total: 100_000 });
    await pedido(c.id, { currency: "COP", total: 200_000 });
    await pedido(c.id, { currency: "USD", total: 50 });

    const m = await customerMetrics(c.id, db);
    expect(m.orders).toBe(3);
    expect(m.primary?.currency).toBe("COP");
    expect(m.primary?.orders).toBe(2);
    expect(m.primary?.avg).toBe(150_000); // no contaminado por los 50 USD
    expect(m.others).toHaveLength(1);
    expect(m.others[0].currency).toBe("USD");
    expect(m.others[0].avg).toBe(50);
  });

  it("los días de inactividad se cuentan desde el último confirmado", async () => {
    const c = await cliente();
    await pedido(c.id, { createdAt: new Date(Date.now() - 10 * 86_400_000) });
    const m = await customerMetrics(c.id, db);
    expect(m.inactiveDays).toBeGreaterThanOrEqual(9);
    expect(m.inactiveDays).toBeLessThanOrEqual(11);
  });
});

describe("top de categorías", () => {
  it("un cliente sin compras devuelve lista vacía, no error", async () => {
    const c = await cliente();
    expect(await topCategories(c.id, 5, db)).toEqual([]);
  });
});

describe("búsqueda y listado", () => {
  it("encuentra por nombre sin distinguir mayúsculas", async () => {
    const c = await cliente({ name: `${MARCA} Mariana Restrepo` });
    const r = await listCustomers({ search: "mariana restrepo" }, db);
    expect(r.rows.map((x) => x.id)).toContain(c.id);
  });

  it("encuentra el mismo teléfono escrito de otra forma", async () => {
    // Es la razón por la que se busca por dígitos y no por la cadena literal.
    const c = await cliente({ phone: "+573001234567" });
    const r = await listCustomers({ search: "300 123 4567" }, db);
    expect(r.rows.map((x) => x.id)).toContain(c.id);
  });

  it("una búsqueda sin resultados devuelve vacío sin error", async () => {
    const r = await listCustomers({ search: "no-existe-jamas-xyz" }, db);
    expect(r.rows).toHaveLength(0);
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(1);
  });

  it("los días de mayor pedido cuentan solo confirmados", async () => {
    const c = await cliente();
    // Tres pedidos confirmados el mismo día de la semana y uno cancelado en otro.
    const lunes = new Date("2026-07-06T12:00:00Z"); // lunes
    const martes = new Date("2026-07-07T12:00:00Z");
    await pedido(c.id, { createdAt: lunes });
    await pedido(c.id, { createdAt: new Date("2026-07-13T12:00:00Z") });
    await pedido(c.id, { status: "CANCELLED", createdAt: martes });

    const r = await listCustomers({ search: c.name }, db);
    const fila = r.rows.find((x) => x.id === c.id)!;
    expect(fila.topWeekdays).toEqual([1]); // 1 = lunes; el martes cancelado no cuenta
  });
});

describe("enlace de WhatsApp", () => {
  it("usa api.whatsapp.com y NUNCA wa.me", () => {
    // La historia de usuario pide wa.me y está equivocada: su redirección rompe
    // los caracteres de 4 bytes. Esta prueba impide que "se corrija" de vuelta.
    const url = whatsappLink("+573208270414")!;
    expect(url).toContain("api.whatsapp.com/send");
    expect(url).not.toContain("wa.me");
  });

  it("sin teléfono no genera enlace roto", () => {
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink("123")).toBeNull();
  });
});
