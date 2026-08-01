// Kora Cashback. Esto acredita DINERO: cada invariante se fija con prueba.
//   1. El saldo materializado y el libro son la misma escritura o no son ninguna.
//   2. El consumo va del lote más próximo a vencer; si no alcanza, no toca nada.
//   3. Vencer registra, no borra.
//   4. Las dos monedas no se suman ni se convierten. Nunca.
//   5. Acreditar el mismo pedido dos veces deja un solo lote — la entrega de la
//      bandeja de salida es *al menos una vez* y nadie reclama que le den de más.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { accrualBase, computeAccrual } from "@/modules/cashback/accrual";
import { activeLots, cashbackBalance, cashbackHistory, pendingCashback } from "@/modules/cashback/balance";
import {
  CashbackError,
  consumeCashback,
  creditCashback,
  expireCashback,
} from "@/modules/cashback/ledger";
import { truncar, vencimientoDesde } from "@/modules/cashback/money";
import { verifyCashbackLedger } from "@/modules/cashback/verify";
import { runOnce } from "@/modules/events/consumer";
import { registerAllHandlers } from "@/modules/events/handlers";
import { orderConfirmedCashbackHandler } from "@/modules/events/handlers/order-confirmed-cashback";
import { resetRegistry } from "@/modules/events/registry";
import type { DomainEventRecord } from "@/modules/events/types";

const PREFIJO = "zzt-cashback";

let n = 0;
async function cliente() {
  n += 1;
  return db.customer.create({
    data: { name: `${PREFIJO} ${n}`, email: `${PREFIJO}-${n}-${Date.now()}@test.local` },
  });
}

async function pedido(
  customerId: string,
  over: { total?: number; currency?: "COP" | "USD"; status?: "PENDING" | "CONFIRMED" } = {},
) {
  const total = over.total ?? 100_000;
  return db.order.create({
    data: {
      channel: "WEB",
      status: over.status ?? "CONFIRMED",
      currency: over.currency ?? "COP",
      customerId,
      subtotal: total,
      total,
      note: PREFIJO,
      expiresAt: new Date(Date.now() + 2 * 3600_000),
    },
  });
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
  await db.orderStatusHistory.deleteMany({ where: { order: { customerId: { in: ids } } } });
  await db.order.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(limpiar);
afterEach(limpiar);

/** Acredita fuera de una transacción propia, como hace el manejador. */
function acreditar(input: Parameters<typeof creditCashback>[1]) {
  return db.$transaction((tx) => creditCashback(tx, input));
}

function consumir(input: Parameters<typeof consumeCashback>[1]) {
  return db.$transaction((tx) => consumeCashback(tx, input));
}

const saldo = (id: string) => cashbackBalance(id);

// ─────────────────────────────────────────────────────────────
describe("cálculo del cashback", () => {
  it("acredita el 3 % de una compra sin descuentos", () => {
    // La tabla del cliente: $40.000 COP → $1.200 COP.
    expect(computeAccrual({ total: 40_000, currency: "COP" })).toBe(1_200);
    // USD $40 → USD $1,20.
    expect(computeAccrual({ total: 40, currency: "USD" })).toBe(1.2);
  });

  it("calcula sobre el dinero pagado, no sobre el total, cuando se usó saldo", () => {
    // El ejemplo textual del cliente: compra de $100.000, paga $80.000 con
    // dinero y $20.000 con saldo → genera $2.400, no $3.000.
    expect(accrualBase({ total: 100_000, cashbackApplied: 20_000, currency: "COP" })).toBe(80_000);
    expect(computeAccrual({ total: 100_000, cashbackApplied: 20_000, currency: "COP" })).toBe(2_400);
  });

  it("una compra cubierta al 100 % con saldo genera cero", () => {
    expect(computeAccrual({ total: 50_000, cashbackApplied: 50_000, currency: "COP" })).toBe(0);
  });

  it("trunca hacia abajo: al peso en COP y al centavo en USD", () => {
    // 3 % de 33.333 = 999,99 → 999. En pesos no hay centavos.
    expect(computeAccrual({ total: 33_333, currency: "COP" })).toBe(999);
    // 3 % de 33,33 = 0,9999 → 0,99.
    expect(computeAccrual({ total: 33.33, currency: "USD" })).toBe(0.99);
    expect(truncar(1_200.99, "COP")).toBe(1_200);
    expect(truncar(1.209, "USD")).toBe(1.2);
  });
});

// ─────────────────────────────────────────────────────────────
describe("libro contable", () => {
  it("acreditar deja movimiento y saldo cuadrados", async () => {
    const c = await cliente();
    const lote = await acreditar({ customerId: c.id, amount: 1_200, currency: "COP" });

    expect(lote.remaining).toBe(1_200);
    expect(await saldo(c.id)).toEqual({ cop: 1_200, usd: 0 });

    const v = await verifyCashbackLedger();
    expect(v.balances.filter((b) => b.customerId === c.id)).toHaveLength(0);
  });

  it("el lote nace con vencimiento a 12 meses", async () => {
    const c = await cliente();
    const ahora = new Date("2026-08-01T12:00:00Z");
    const lote = await acreditar({ customerId: c.id, amount: 1_000, currency: "COP", now: ahora });
    expect(lote.expiresAt.toISOString()).toBe(vencimientoDesde(ahora).toISOString());
    expect(lote.expiresAt.getUTCFullYear()).toBe(2027);
  });

  it("un fallo a mitad no deja ni movimiento ni saldo", async () => {
    const c = await cliente();
    await expect(
      db.$transaction(async (tx) => {
        await creditCashback(tx, { customerId: c.id, amount: 5_000, currency: "COP" });
        throw new Error("fallo simulado después de acreditar");
      }),
    ).rejects.toThrow("fallo simulado");

    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 0 });
    expect(await db.cashbackMovement.count({ where: { customerId: c.id } })).toBe(0);
  });

  it("rechaza acreditar un importe no positivo", async () => {
    const c = await cliente();
    await expect(acreditar({ customerId: c.id, amount: 0, currency: "COP" })).rejects.toBeInstanceOf(
      CashbackError,
    );
  });
});

// ─────────────────────────────────────────────────────────────
describe("consumo por antigüedad", () => {
  it("gasta primero el lote más próximo a vencer y cruza al siguiente", async () => {
    const c = await cliente();
    const viejo = await acreditar({
      customerId: c.id,
      amount: 1_000,
      currency: "COP",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const nuevo = await acreditar({
      customerId: c.id,
      amount: 3_000,
      currency: "COP",
      now: new Date("2026-06-01T00:00:00Z"),
    });

    const r = await consumir({ customerId: c.id, amount: 1_500, currency: "COP" });

    expect(r.consumed).toBe(1_500);
    expect(r.fromLots).toEqual([
      { lotId: viejo.id, amount: 1_000 },
      { lotId: nuevo.id, amount: 500 },
    ]);
    expect(await saldo(c.id)).toEqual({ cop: 2_500, usd: 0 });

    const lotes = await activeLots(c.id);
    expect(lotes.find((l) => l.id === viejo.id)).toBeUndefined(); // agotado
    expect(lotes.find((l) => l.id === nuevo.id)?.remaining).toBe(2_500);
  });

  it("consumir más de lo disponible se rechaza sin tocar ningún lote", async () => {
    const c = await cliente();
    const lote = await acreditar({ customerId: c.id, amount: 1_000, currency: "COP" });

    await expect(consumir({ customerId: c.id, amount: 1_500, currency: "COP" })).rejects.toMatchObject(
      { code: "INSUFFICIENT" },
    );

    expect(await saldo(c.id)).toEqual({ cop: 1_000, usd: 0 });
    const lotes = await activeLots(c.id);
    expect(lotes.find((l) => l.id === lote.id)?.remaining).toBe(1_000);
    // Ni un movimiento de consumo escrito.
    expect(await db.cashbackMovement.count({ where: { customerId: c.id, type: "REDEEM" } })).toBe(0);
  });

  it("un lote vencido no se puede gastar aunque el saldo lo sugiera", async () => {
    const c = await cliente();
    await acreditar({
      customerId: c.id,
      amount: 2_000,
      currency: "COP",
      now: new Date("2024-01-01T00:00:00Z"), // vencido hace tiempo
    });
    await expect(consumir({ customerId: c.id, amount: 500, currency: "COP" })).rejects.toMatchObject({
      code: "INSUFFICIENT",
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe("vencimiento", () => {
  it("vence solo el remanente de un lote ya consumido en parte, y lo registra", async () => {
    const c = await cliente();
    const lote = await acreditar({
      customerId: c.id,
      amount: 1_000,
      currency: "COP",
      now: new Date("2025-01-01T00:00:00Z"), // vence 1 ene 2026
    });
    // Se gasta una parte mientras el lote aún estaba vigente.
    await consumir({
      customerId: c.id,
      amount: 400,
      currency: "COP",
      now: new Date("2025-06-01T00:00:00Z"),
    });
    expect(await saldo(c.id)).toEqual({ cop: 600, usd: 0 });

    const r = await expireCashback(new Date("2026-02-01T00:00:00Z"));

    expect(r.lots).toBeGreaterThanOrEqual(1);
    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 0 });

    const mov = await db.cashbackMovement.findFirst({
      where: { customerId: c.id, type: "EXPIRE" },
    });
    expect(Number(mov?.delta)).toBe(-600); // solo el remanente

    // El lote sigue ahí: el libro tiene que seguir explicando el saldo.
    const original = await db.cashbackMovement.findUnique({ where: { id: lote.id } });
    expect(Number(original?.delta)).toBe(1_000);
    expect(Number(original?.remaining)).toBe(0);
  });

  it("el historial conserva acreditación, consumo y vencimiento", async () => {
    const c = await cliente();
    await acreditar({
      customerId: c.id,
      amount: 1_000,
      currency: "COP",
      now: new Date("2025-01-01T00:00:00Z"),
    });
    await consumir({
      customerId: c.id,
      amount: 300,
      currency: "COP",
      now: new Date("2025-06-01T00:00:00Z"),
    });
    await expireCashback(new Date("2026-02-01T00:00:00Z"));

    const tipos = (await cashbackHistory(c.id)).map((m) => m.type).sort();
    expect(tipos).toEqual(["EARN", "EXPIRE", "REDEEM"]);
  });

  it("sin lotes cumplidos no vence nada", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 1_000, currency: "COP" });
    const r = await expireCashback(new Date());
    expect(r.lots).toBe(0);
    expect(await saldo(c.id)).toEqual({ cop: 1_000, usd: 0 });
  });
});

// ─────────────────────────────────────────────────────────────
describe("las dos monedas son dos bolsas", () => {
  it("acreditar en dólares no altera el saldo en pesos", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 5_000, currency: "COP" });
    await acreditar({ customerId: c.id, amount: 1.2, currency: "USD" });
    expect(await saldo(c.id)).toEqual({ cop: 5_000, usd: 1.2 });
  });

  it("no se puede pagar en dólares con saldo en pesos", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 500_000, currency: "COP" });
    await expect(consumir({ customerId: c.id, amount: 10, currency: "USD" })).rejects.toMatchObject({
      code: "INSUFFICIENT",
    });
    expect(await saldo(c.id)).toEqual({ cop: 500_000, usd: 0 });
  });
});

// ─────────────────────────────────────────────────────────────
describe("verificación contable", () => {
  it("detecta un saldo descuadrado y NO lo corrige", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 1_000, currency: "COP" });

    // Se descuadra a mano, saltándose el libro — exactamente lo que la
    // verificación existe para descubrir.
    await db.customer.update({ where: { id: c.id }, data: { cashbackCop: 9_999 } });

    const v = await verifyCashbackLedger();
    const mio = v.balances.find((b) => b.customerId === c.id && b.currency === "COP");
    expect(mio).toMatchObject({ balance: 9_999, ledgerSum: 1_000 });

    // Avisa, no corrige: el saldo sigue mal después de verificar.
    const despues = await db.customer.findUnique({ where: { id: c.id } });
    expect(Number(despues?.cashbackCop)).toBe(9_999);
  });

  it("detecta un lote con remanente imposible", async () => {
    const c = await cliente();
    const lote = await acreditar({ customerId: c.id, amount: 1_000, currency: "COP" });
    await db.cashbackMovement.update({ where: { id: lote.id }, data: { remaining: 4_000 } });

    const v = await verifyCashbackLedger();
    expect(v.lots.some((l) => l.movementId === lote.id)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe("acreditación al confirmar el pedido", () => {
  function evento(orderId: string, id = `evt-${Math.random().toString(36).slice(2)}`): DomainEventRecord {
    return { id, type: "order.confirmed", payload: { orderId }, attempts: 1, createdAt: new Date() };
  }

  it("acredita el 3 % del pedido confirmado en su moneda", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 40_000 });

    await orderConfirmedCashbackHandler.handle(evento(p.id));

    expect(await saldo(c.id)).toEqual({ cop: 1_200, usd: 0 });
    const lote = await db.cashbackMovement.findFirst({ where: { orderId: p.id, type: "EARN" } });
    expect(lote?.currency).toBe("COP");
  });

  it("un pedido en dólares alimenta la bolsa en dólares", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 40, currency: "USD" });

    await orderConfirmedCashbackHandler.handle(evento(p.id));

    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 1.2 });
  });

  it("EL MISMO EVENTO DOS VECES DEJA UN SOLO LOTE", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 100_000 });

    const e = evento(p.id);
    await orderConfirmedCashbackHandler.handle(e);
    await orderConfirmedCashbackHandler.handle(e); // reentrega
    await orderConfirmedCashbackHandler.handle(evento(p.id)); // otro evento, mismo pedido

    expect(await db.cashbackMovement.count({ where: { orderId: p.id, type: "EARN" } })).toBe(1);
    expect(await saldo(c.id)).toEqual({ cop: 3_000, usd: 0 });
  });

  it("DOS TRABAJADORES A LA VEZ sobre el mismo pedido dejan un solo lote", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 100_000 });

    // Leer no es reservar: ambos ven "no hay lote" y ambos intentan acreditar.
    // Quien pierde la carrera choca con el índice único y sale en silencio.
    const r = await Promise.allSettled([
      orderConfirmedCashbackHandler.handle(evento(p.id)),
      orderConfirmedCashbackHandler.handle(evento(p.id)),
    ]);

    expect(r.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await db.cashbackMovement.count({ where: { orderId: p.id, type: "EARN" } })).toBe(1);
    expect(await saldo(c.id)).toEqual({ cop: 3_000, usd: 0 });
  });

  it("la base rechaza un segundo lote del mismo pedido, aunque se le pida", async () => {
    // Sin pasar por el manejador: es la garantía de la BASE la que se prueba.
    // La comprobación del código evita el trabajo; esto evita el dinero.
    const c = await cliente();
    const p = await pedido(c.id, { total: 100_000 });

    await acreditar({ customerId: c.id, amount: 3_000, currency: "COP", orderId: p.id });
    await expect(
      acreditar({ customerId: c.id, amount: 3_000, currency: "COP", orderId: p.id }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(await saldo(c.id)).toEqual({ cop: 3_000, usd: 0 });
  });

  it("un pedido sin cliente no acredita y deja constancia", async () => {
    const p = await db.order.create({
      data: {
        channel: "WEB",
        status: "CONFIRMED",
        currency: "COP",
        subtotal: 50_000,
        total: 50_000,
        note: PREFIJO,
      },
    });

    await expect(orderConfirmedCashbackHandler.handle(evento(p.id))).resolves.toBeUndefined();
    expect(await db.cashbackMovement.count({ where: { orderId: p.id } })).toBe(0);

    const nota = await db.orderStatusHistory.findFirst({ where: { orderId: p.id } });
    expect(nota?.note).toContain("sin cliente");

    await db.orderStatusHistory.deleteMany({ where: { orderId: p.id } });
    await db.order.delete({ where: { id: p.id } });
  });

  it("un pedido de total cero no acredita nada", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 0 });

    await orderConfirmedCashbackHandler.handle(evento(p.id));

    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 0 });
    expect(await db.cashbackMovement.count({ where: { orderId: p.id } })).toBe(0);
  });

  it("un evento sin pedido utilizable falla de forma visible", async () => {
    await expect(
      orderConfirmedCashbackHandler.handle({
        id: "evt-roto",
        type: "order.confirmed",
        payload: {},
        attempts: 1,
        createdAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe("de punta a punta: pedido confirmado → worker → saldo", () => {
  /**
   * Aparta los eventos reales mientras corre la prueba.
   *
   * `runOnce` toma lo que haya —no debe filtrar por tipo, su trabajo es
   * procesar la cola— así que en una base de desarrollo con eventos reales
   * acabaría acreditándoles cashback dentro de una prueba. Empujarlos fuera de
   * su turno los hace invisibles para la toma sin borrarlos; al terminar
   * vuelven a su sitio y el worker los procesará cuando toque.
   */
  async function apartarReales() {
    await db.domainEvent.updateMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PENDING", claimedAt: null, nextAttemptAt: new Date(Date.now() + 3600_000) },
    });
  }

  async function devolverReales() {
    await db.domainEvent.updateMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PENDING", claimedAt: null, nextAttemptAt: new Date() },
    });
  }

  beforeEach(async () => {
    resetRegistry();
    registerAllHandlers();
    await apartarReales();
  });
  afterEach(async () => {
    await devolverReales();
    resetRegistry();
  });

  it("el evento de la bandeja de salida acredita el saldo del cliente", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 150_000 });

    // Lo que escribe `confirmOrder()` en la misma transacción que descuenta stock.
    await db.domainEvent.create({
      data: { type: "order.confirmed", payload: { orderId: p.id, orderNumber: p.number } },
    });

    const outcomes = await runOnce();

    expect(outcomes.some((o) => o.result === "processed")).toBe(true);
    expect(await saldo(c.id)).toEqual({ cop: 4_500, usd: 0 });

    // Volver a correr el worker no vuelve a acreditar.
    await runOnce();
    expect(await saldo(c.id)).toEqual({ cop: 4_500, usd: 0 });

    await db.domainEvent.deleteMany({ where: { payload: { path: ["orderId"], equals: p.id } } });
  });
});

// ─────────────────────────────────────────────────────────────
describe("pendiente", () => {
  it("un pedido creado sin confirmar cuenta como pendiente y no como disponible", async () => {
    const c = await cliente();
    await pedido(c.id, { total: 100_000, status: "PENDING" });

    expect(await pendingCashback(c.id)).toEqual({ cop: 3_000, usd: 0 });
    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 0 });
  });

  it("al confirmarse deja de ser pendiente y pasa a disponible", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { total: 100_000, status: "PENDING" });

    await db.order.update({ where: { id: p.id }, data: { status: "CONFIRMED" } });
    await orderConfirmedCashbackHandler.handle({
      id: "evt-1",
      type: "order.confirmed",
      payload: { orderId: p.id },
      attempts: 1,
      createdAt: new Date(),
    });

    expect(await pendingCashback(c.id)).toEqual({ cop: 0, usd: 0 });
    expect(await saldo(c.id)).toEqual({ cop: 3_000, usd: 0 });
  });

  it("un pedido pendiente que expiró deja de contar, sin haber sido nunca disponible", async () => {
    const c = await cliente();
    await db.order.create({
      data: {
        channel: "WEB",
        status: "PENDING",
        currency: "COP",
        customerId: c.id,
        subtotal: 100_000,
        total: 100_000,
        note: PREFIJO,
        expiresAt: new Date(Date.now() - 3600_000), // venció hace una hora
      },
    });

    expect(await pendingCashback(c.id)).toEqual({ cop: 0, usd: 0 });
    expect(await saldo(c.id)).toEqual({ cop: 0, usd: 0 });
  });
});
