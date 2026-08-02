// Dashboard. Es la primera pantalla que ve el operador: una pantalla que miente
// es peor que una vacía. Un cero en una gráfica se lee como "no vendimos", no
// como "esto no está conectado".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { salesLastWeek, topProducts } from "@/modules/dashboard/queries";

const MARCA = "ZZDASH";

async function limpiar() {
  const pedidos = (
    await db.order.findMany({ where: { contactName: MARCA }, select: { id: true } })
  ).map((o) => o.id);
  if (pedidos.length === 0) return;
  await db.orderItem.deleteMany({ where: { orderId: { in: pedidos } } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: pedidos } } });
  await db.couponRedemption.deleteMany({ where: { orderId: { in: pedidos } } });
  await db.order.deleteMany({ where: { id: { in: pedidos } } });
}

async function pedido(over: Record<string, unknown> = {}) {
  return db.order.create({
    data: {
      channel: "WEB",
      status: "CONFIRMED",
      currency: "COP",
      subtotal: 50_000,
      total: 50_000,
      contactName: MARCA,
      confirmedAt: new Date(),
      ...over,
    },
  });
}

beforeEach(limpiar);
afterEach(limpiar);

describe("ventas de la semana", () => {
  it("devuelve SIEMPRE siete días, con cero donde no hubo ventas", async () => {
    // Pintar solo los días con datos haría que una semana con dos ventas se
    // leyera como una semana de dos días.
    const dias = await salesLastWeek("COP", db);
    expect(dias).toHaveLength(7);
    for (const d of dias) expect(typeof d.total).toBe("number");
  });

  it("un pedido PENDIENTE no suma", async () => {
    const antes = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    await pedido({ status: "PENDING", confirmedAt: null, total: 99_999 });
    const despues = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    expect(despues).toBe(antes);
  });

  it("un pedido CANCELADO no suma", async () => {
    const antes = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    await pedido({ status: "CANCELLED", total: 99_999 });
    const despues = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    expect(despues).toBe(antes);
  });

  it("un pedido confirmado SÍ suma", async () => {
    const antes = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    await pedido({ total: 33_000 });
    const despues = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    expect(despues).toBe(antes + 33_000);
  });

  it("un pedido ENTREGADO sigue contando: es una venta", async () => {
    const antes = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    await pedido({ status: "DELIVERED", total: 12_000 });
    const despues = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    expect(despues).toBe(antes + 12_000);
  });

  it("no mezcla monedas", async () => {
    // No hay tasa de cambio en KORA: sumar pesos y dólares daría una barra de
    // altura sin significado.
    const antesCop = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    await pedido({ currency: "USD", total: 500 });
    const despuesCop = (await salesLastWeek("COP", db)).reduce((s, d) => s + d.total, 0);
    expect(despuesCop).toBe(antesCop);
  });
});

describe("top de productos", () => {
  it("ordena por unidades vendidas y devuelve números, no promesas", async () => {
    const top = await topProducts("COP", 5, db);
    for (const p of top) {
      expect(Number.isFinite(p.units)).toBe(true);
      expect(Number.isFinite(p.revenue)).toBe(true);
    }
    // Descendente por unidades.
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].units).toBeGreaterThanOrEqual(top[i].units);
    }
  });

  it("respeta el límite", async () => {
    expect((await topProducts("COP", 2, db)).length).toBeLessThanOrEqual(2);
  });
});
