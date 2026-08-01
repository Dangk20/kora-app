// Canje de Kora Cashback. Lo que se fija aquí:
//   1. El descuento lo decide el SERVIDOR; nada del navegador fija un importe.
//   2. Dos pedidos peleando por el mismo saldo: gana uno, y nunca queda negativo.
//   3. La devolución vuelve a LOS LOTES ORIGINALES, con su vencimiento intacto
//      — si creara lotes nuevos, abandonar pedidos renovaría el cashback.
//   4. Devolver dos veces no regala saldo; reabrir un pedido lo vuelve a gastar.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cashbackBalance } from "@/modules/cashback/balance";
import { consumeCashback, creditCashback } from "@/modules/cashback/ledger";
import { applicableAmount, MENSAJE_RECHAZO, resolveRedemption } from "@/modules/cashback/redemption";
import { outstandingCashback, refundOrderCashback } from "@/modules/cashback/refund";
import { verifyCashbackLedger } from "@/modules/cashback/verify";

const PREFIJO = "zzt-canje";

let n = 0;
async function cliente() {
  n += 1;
  return db.customer.create({
    data: { name: `${PREFIJO} ${n}`, email: `${PREFIJO}-${n}-${Date.now()}@test.local` },
  });
}

async function pedido(customerId: string, over: { total?: number; applied?: number } = {}) {
  const total = over.total ?? 100_000;
  return db.order.create({
    data: {
      channel: "WEB",
      status: "PENDING",
      currency: "COP",
      customerId,
      subtotal: total,
      total,
      cashbackApplied: over.applied ?? 0,
      note: PREFIJO,
      expiresAt: new Date(Date.now() + 2 * 3600_000),
    },
  });
}

const acreditar = (input: Parameters<typeof creditCashback>[1]) =>
  db.$transaction((tx) => creditCashback(tx, input));

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

// ─────────────────────────────────────────────────────────────
describe("cuánto se puede aplicar", () => {
  const base = { requested: 10_000, available: 50_000, orderTotal: 80_000, currency: "COP" as const };

  it("aplica lo pedido cuando cabe", () => {
    expect(applicableAmount(base)).toEqual({ ok: true, amount: 10_000 });
  });

  it("NUNCA aplica más que el saldo disponible", () => {
    expect(applicableAmount({ ...base, requested: 90_000, available: 30_000 })).toEqual({
      ok: true,
      amount: 30_000,
    });
  });

  it("NUNCA aplica más que el total: el cashback no deja saldo a favor", () => {
    expect(applicableAmount({ ...base, requested: 90_000, orderTotal: 40_000 })).toEqual({
      ok: true,
      amount: 40_000,
    });
  });

  it("sin saldo, lo dice", () => {
    const r = applicableAmount({ ...base, available: 0 });
    expect(r).toMatchObject({ ok: false, reason: "NO_BALANCE" });
  });

  it("trunca hacia abajo, como el resto del módulo", () => {
    expect(applicableAmount({ ...base, requested: 1_500.99 })).toEqual({ ok: true, amount: 1_500 });
  });
});

// ─────────────────────────────────────────────────────────────
describe("el servidor decide, no el navegador", () => {
  it("un importe manipulado se recorta al saldo real", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 5_000, currency: "COP" });

    // El navegador pide 500.000; el libro dice 5.000.
    const r = await resolveRedemption({
      customerId: c.id,
      requested: 500_000,
      orderTotal: 400_000,
      currency: "COP",
      hasCoupon: false,
    });

    expect(r).toEqual({ ok: true, amount: 5_000 });
  });

  it("SIN SESIÓN no se puede gastar, aunque el cliente tenga saldo", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 50_000, currency: "COP" });

    const r = await resolveRedemption({
      customerId: null, // invitado: su identidad sería un correo escrito
      requested: 10_000,
      orderTotal: 80_000,
      currency: "COP",
      hasCoupon: false,
    });

    expect(r).toMatchObject({ ok: false, reason: "NO_SESSION" });
  });

  it("CUPÓN Y CASHBACK NO SE COMBINAN, aunque lleguen los dos", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 50_000, currency: "COP" });

    const r = await resolveRedemption({
      customerId: c.id,
      requested: 10_000,
      orderTotal: 80_000,
      currency: "COP",
      hasCoupon: true,
    });

    expect(r).toEqual({ ok: false, reason: "WITH_COUPON", message: MENSAJE_RECHAZO.WITH_COUPON });
  });

  it("un pedido en dólares no puede gastar saldo en pesos", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 500_000, currency: "COP" });

    const r = await resolveRedemption({
      customerId: c.id,
      requested: 20,
      orderTotal: 100,
      currency: "USD",
      hasCoupon: false,
    });

    expect(r).toMatchObject({ ok: false, reason: "NO_BALANCE" });
  });
});

// ─────────────────────────────────────────────────────────────
describe("concurrencia: dos pedidos por el mismo saldo", () => {
  it("GANA UNO SOLO y el saldo nunca queda negativo", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 10_000, currency: "COP" });

    // Los dos ven 10.000 disponibles y los dos intentan gastarlos.
    const resultados = await Promise.allSettled([
      db.$transaction((tx) =>
        consumeCashback(tx, { customerId: c.id, amount: 10_000, currency: "COP" }),
      ),
      db.$transaction((tx) =>
        consumeCashback(tx, { customerId: c.id, amount: 10_000, currency: "COP" }),
      ),
    ]);

    const ganadores = resultados.filter((r) => r.status === "fulfilled");
    expect(ganadores).toHaveLength(1);
    expect(await cashbackBalance(c.id)).toEqual({ cop: 0, usd: 0 });

    const v = await verifyCashbackLedger();
    expect(v.balances.find((b) => b.customerId === c.id)).toBeUndefined();
  });

  it("si la operación que envuelve al consumo falla, no queda consumo", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 10_000, currency: "COP" });

    await expect(
      db.$transaction(async (tx) => {
        await consumeCashback(tx, { customerId: c.id, amount: 4_000, currency: "COP" });
        throw new Error("el pedido no se pudo crear");
      }),
    ).rejects.toThrow("el pedido no se pudo crear");

    expect(await cashbackBalance(c.id)).toEqual({ cop: 10_000, usd: 0 });
  });
});

// ─────────────────────────────────────────────────────────────
describe("devolución", () => {
  it("VUELVE AL LOTE ORIGINAL, conservando su vencimiento", async () => {
    const c = await cliente();
    const lote = await acreditar({
      customerId: c.id,
      amount: 10_000,
      currency: "COP",
      now: new Date("2026-03-01T00:00:00Z"), // vence 1 mar 2027
    });
    const p = await pedido(c.id, { applied: 4_000 });
    await db.$transaction((tx) =>
      consumeCashback(tx, { customerId: c.id, amount: 4_000, currency: "COP", orderId: p.id }),
    );
    expect(await cashbackBalance(c.id)).toEqual({ cop: 6_000, usd: 0 });

    const r = await db.$transaction((tx) => refundOrderCashback(tx, p.id));

    expect(r.refunded).toBe(4_000);
    expect(await cashbackBalance(c.id)).toEqual({ cop: 10_000, usd: 0 });

    // NO se creó un lote nuevo: el remanente volvió al de siempre, con su fecha.
    const lotes = await db.cashbackMovement.findMany({
      where: { customerId: c.id, type: "EARN" },
    });
    expect(lotes).toHaveLength(1);
    expect(Number(lotes[0].remaining)).toBe(10_000);
    expect(lotes[0].id).toBe(lote.id);
    expect(lotes[0].expiresAt?.toISOString()).toBe(lote.expiresAt.toISOString());
  });

  it("DEVOLVER DOS VECES no regala saldo", async () => {
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 10_000, currency: "COP" });
    const p = await pedido(c.id, { applied: 4_000 });
    await db.$transaction((tx) =>
      consumeCashback(tx, { customerId: c.id, amount: 4_000, currency: "COP", orderId: p.id }),
    );

    await db.$transaction((tx) => refundOrderCashback(tx, p.id));
    const segunda = await db.$transaction((tx) => refundOrderCashback(tx, p.id));

    expect(segunda).toMatchObject({ refunded: 0, alreadyDone: true });
    expect(await cashbackBalance(c.id)).toEqual({ cop: 10_000, usd: 0 });
  });

  it("un pedido sin cashback aplicado no devuelve nada", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const r = await db.$transaction((tx) => refundOrderCashback(tx, p.id));
    expect(r.refunded).toBe(0);
  });

  it("devuelve el remanente cruzando varios lotes", async () => {
    const c = await cliente();
    await acreditar({
      customerId: c.id,
      amount: 3_000,
      currency: "COP",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    await acreditar({
      customerId: c.id,
      amount: 5_000,
      currency: "COP",
      now: new Date("2026-06-01T00:00:00Z"),
    });
    const p = await pedido(c.id, { applied: 6_000 });
    await db.$transaction((tx) =>
      consumeCashback(tx, { customerId: c.id, amount: 6_000, currency: "COP", orderId: p.id }),
    );
    expect(await cashbackBalance(c.id)).toEqual({ cop: 2_000, usd: 0 });

    await db.$transaction((tx) => refundOrderCashback(tx, p.id));

    expect(await cashbackBalance(c.id)).toEqual({ cop: 8_000, usd: 0 });
    const lotes = await db.cashbackMovement.findMany({
      where: { customerId: c.id, type: "EARN" },
      orderBy: { createdAt: "asc" },
    });
    expect(lotes.map((l) => Number(l.remaining))).toEqual([3_000, 5_000]);
  });

  it("UN PEDIDO REABIERTO vuelve a gastar el saldo, y devolverlo otra vez funciona", async () => {
    // Es el ciclo que rompería una idempotencia ingenua ("¿ya hay devolución?"):
    // cancelar → devolver → reabrir → volver a gastar → cancelar → devolver.
    const c = await cliente();
    await acreditar({ customerId: c.id, amount: 10_000, currency: "COP" });
    const p = await pedido(c.id, { applied: 4_000 });

    const gastar = () =>
      db.$transaction((tx) =>
        consumeCashback(tx, { customerId: c.id, amount: 4_000, currency: "COP", orderId: p.id }),
      );
    const devolver = () => db.$transaction((tx) => refundOrderCashback(tx, p.id));

    await gastar();
    await devolver();
    expect(await cashbackBalance(c.id)).toEqual({ cop: 10_000, usd: 0 });

    await gastar(); // reapertura
    expect(await cashbackBalance(c.id)).toEqual({ cop: 6_000, usd: 0 });
    expect(await db.$transaction((tx) => outstandingCashback(tx, p.id))).toBe(4_000);

    await devolver();
    expect(await cashbackBalance(c.id)).toEqual({ cop: 10_000, usd: 0 });

    const v = await verifyCashbackLedger();
    expect(v.balances.find((b) => b.customerId === c.id)).toBeUndefined();
    expect(v.lots.find((l) => l.customerId === c.id)).toBeUndefined();
  });

  it("un lote que venció mientras el pedido esperaba recibe el importe SIN volverse gastable", async () => {
    const c = await cliente();
    await acreditar({
      customerId: c.id,
      amount: 10_000,
      currency: "COP",
      now: new Date("2025-01-01T00:00:00Z"), // vence 1 ene 2026, ya pasado
    });
    const p = await pedido(c.id, { applied: 4_000 });
    await db.$transaction((tx) =>
      consumeCashback(tx, {
        customerId: c.id,
        amount: 4_000,
        currency: "COP",
        orderId: p.id,
        now: new Date("2025-06-01T00:00:00Z"), // se gastó cuando aún valía
      }),
    );

    await db.$transaction((tx) => refundOrderCashback(tx, p.id));

    // El saldo materializado vuelve, pero el lote está vencido: no se puede
    // gastar. Un pedido abandonado no extiende la vida del cashback.
    const lote = await db.cashbackMovement.findFirst({
      where: { customerId: c.id, type: "EARN" },
    });
    expect(Number(lote?.remaining)).toBe(10_000);
    expect(lote!.expiresAt!.getTime()).toBeLessThan(Date.now());

    await expect(
      db.$transaction((tx) =>
        consumeCashback(tx, { customerId: c.id, amount: 1_000, currency: "COP" }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT" });
  });
});
