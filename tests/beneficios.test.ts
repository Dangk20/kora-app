// Beneficios de los clientes (change beneficios): otorgar, ver y canjear en
// caja, y el 3 % de Kora Cashback que ahora acumula la venta de mostrador.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStockTo } from "@/modules/inventory/engine";
import { registrarVentaPos } from "@/modules/pos/sale";
import { abrirTurno } from "@/modules/pos/turno";
import { beneficiosDe, beneficiosParaCaja, estadoDe, otorgarBeneficio } from "@/modules/benefits/benefits";

const PREFIJO = "tst-beneficios";
const CAJA = "Caja test beneficios";
const SKU_MAQ = "TEST-BEN-MAQ-1";
const SKU_ROPA = "TEST-BEN-ROPA-1";
const CEL = "+573109990077";
const CEL_OTRO = "+573109990078";

let adminId = "";
let varMaq = "";
let varRopa = "";
let catPadre = "";
let clienteId = "";
let otroId = "";

const vender = (input: unknown) => registrarVentaPos(input, adminId, CAJA);
const cliente = () => ({ id: clienteId, name: "Cliente Beneficios", phone: "3109990077" });

async function limpiar() {
  const clientes = { customer: { phone: { in: [CEL, CEL_OTRO] } } };
  const pedidos = await db.order.findMany({
    where: { OR: [{ items: { some: { sku: { in: [SKU_MAQ, SKU_ROPA] } } } }, { contactPhone: { in: [CEL, CEL_OTRO] } }] },
    select: { id: true },
  });
  const ids = pedidos.map((p) => p.id);
  await db.benefit.deleteMany({ where: clientes });
  await db.cashbackMovement.deleteMany({ where: { OR: [clientes, { orderId: { in: ids } }] } });
  await db.salesDocument.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockMovement.deleteMany({ where: { variant: { sku: { in: [SKU_MAQ, SKU_ROPA] } } } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  const turnos = await db.cashSession.findMany({ where: { register: CAJA }, select: { id: true } });
  await db.cashMovement.deleteMany({ where: { sessionId: { in: turnos.map((t) => t.id) } } });
  await db.cashSession.deleteMany({ where: { register: CAJA } });
  await db.customer.deleteMany({ where: { phone: { in: [CEL, CEL_OTRO] } } });
  await db.variant.deleteMany({ where: { sku: { in: [SKU_MAQ, SKU_ROPA] } } });
  await db.product.deleteMany({ where: { slug: { startsWith: PREFIJO } } });
  await db.category.deleteMany({ where: { slug: `${PREFIJO}-labiales` } });
  await db.category.deleteMany({ where: { slug: { startsWith: PREFIJO } } });
}

async function stock(variantId: string, n: number) {
  await setStockTo({ variantId, target: n, onlineTarget: 0, reason: "AJUSTE_MANUAL", actorId: adminId, note: "test beneficios" });
}

beforeAll(async () => {
  await limpiar();
  adminId = (await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } })).id;
  // Maquillaje > Labiales: el beneficio de la categoría padre cubre la hija.
  catPadre = (await db.category.create({ data: { name: "Maquillaje test", slug: `${PREFIJO}-maquillaje` } })).id;
  const hija = await db.category.create({ data: { name: "Labiales test", slug: `${PREFIJO}-labiales`, parentId: catPadre } });
  const ropa = await db.category.create({ data: { name: "Ropa test", slug: `${PREFIJO}-ropa` } });
  const pMaq = await db.product.create({ data: { name: "Labial test", slug: `${PREFIJO}-labial`, categoryId: hija.id, active: true } });
  const pRopa = await db.product.create({ data: { name: "Camiseta test", slug: `${PREFIJO}-camiseta`, categoryId: ropa.id, active: true } });
  const precios = { priceCopOnline: 1, priceUsdStore: 1, priceUsdOnline: 1 };
  varMaq = (await db.variant.create({ data: { productId: pMaq.id, sku: SKU_MAQ, name: "Única", priceCopStore: 40_000, ...precios } })).id;
  varRopa = (await db.variant.create({ data: { productId: pRopa.id, sku: SKU_ROPA, name: "Talla M", priceCopStore: 60_000, ...precios } })).id;
  await stock(varMaq, 20);
  await stock(varRopa, 20);
  clienteId = (await db.customer.create({ data: { name: "Cliente Beneficios", phone: CEL, source: "POS" } })).id;
  otroId = (await db.customer.create({ data: { name: "Otro Cliente", phone: CEL_OTRO, source: "POS" } })).id;
  expect((await abrirTurno(0, adminId, CAJA)).ok).toBe(true);
});

afterAll(limpiar);

describe("otorgar", () => {
  it("el cashback de regalo entra al saldo como lote propio que vence a los 30 días", async () => {
    const r = await otorgarBeneficio({ customerId: clienteId, kind: "CASHBACK", amount: 10_000, grantedById: adminId });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const b = await db.benefit.findUniqueOrThrow({ where: { id: r.id }, include: { cashbackMovement: true } });
    expect(Number(b.cashbackMovement?.delta)).toBe(10_000);
    expect(b.cashbackMovement?.expiresAt?.getTime()).toBe(b.expiresAt.getTime());
    const dias = (b.expiresAt.getTime() - b.createdAt.getTime()) / 86_400_000;
    expect(dias).toBe(30);
    const c = await db.customer.findUniqueOrThrow({ where: { id: clienteId } });
    expect(Number(c.cashbackCop)).toBe(10_000);
    // No se canjea en caja: va por el saldo.
    expect((await beneficiosParaCaja(clienteId)).some((x) => x.id === r.id)).toBe(false);
  });

  it("valida los datos de cada tipo", async () => {
    expect((await otorgarBeneficio({ customerId: clienteId, kind: "DESCUENTO_CATEGORIA", amount: 150, categoryId: catPadre })).ok).toBe(false);
    expect((await otorgarBeneficio({ customerId: clienteId, kind: "DESCUENTO_CATEGORIA", amount: 10 })).ok).toBe(false);
    expect((await otorgarBeneficio({ customerId: clienteId, kind: "PRODUCTO_GRATIS" })).ok).toBe(false);
    expect((await otorgarBeneficio({ customerId: clienteId, kind: "CASHBACK", amount: 0 })).ok).toBe(false);
  });

  it("el estado se deriva: vigente, usado o vencido", () => {
    const ahora = new Date("2026-10-17T12:00:00Z");
    expect(estadoDe({ usedAt: null, expiresAt: new Date("2026-11-01") }, ahora)).toBe("VIGENTE");
    expect(estadoDe({ usedAt: null, expiresAt: new Date("2026-10-01") }, ahora)).toBe("VENCIDO");
    expect(estadoDe({ usedAt: ahora, expiresAt: new Date("2026-10-01") }, ahora)).toBe("USADO");
  });
});

describe("canje en caja", () => {
  it("el descuento por categoría aplica sobre su subcategoría, una sola vez, y el cashback sale de lo pagado", async () => {
    const r0 = await otorgarBeneficio({ customerId: clienteId, kind: "DESCUENTO_CATEGORIA", amount: 10, categoryId: catPadre });
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;
    const r = await vender({
      lines: [{ variantId: varMaq, qty: 2 }, { variantId: varRopa, qty: 1 }],
      method: "Datáfono",
      customer: cliente(),
      benefitId: r0.id,
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    // 10 % de los 80.000 de maquillaje; la ropa no entra.
    expect(r.discount).toBe(8_000);
    expect(r.total).toBe(140_000 - 8_000);
    // 3 % de lo pagado con dinero.
    expect(r.cashback).toBe(Math.floor(132_000 * 0.03));
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(Number(o.subtotal)).toBe(140_000);
    expect(Number(o.discountTotal)).toBe(8_000);
    expect(Number(o.total)).toBe(132_000);
    const lote = await db.cashbackMovement.findFirstOrThrow({ where: { orderId: r.orderId, type: "EARN" } });
    expect(Number(lote.delta)).toBe(3_960);
    const b = await db.benefit.findUniqueOrThrow({ where: { id: r0.id } });
    expect(b.usedOrderId).toBe(r.orderId);

    // Segunda vez: ya se usó, y no se vende nada.
    const antes = (await db.variant.findUniqueOrThrow({ where: { id: varMaq } })).stockActual;
    const r2 = await vender({ lines: [{ variantId: varMaq, qty: 1 }], method: "Datáfono", customer: cliente(), benefitId: r0.id });
    expect(r2).toEqual({ ok: false, error: "Ese beneficio ya se usó" });
    expect((await db.variant.findUniqueOrThrow({ where: { id: varMaq } })).stockActual).toBe(antes);
  });

  it("el producto de regalo descuenta una unidad y exige tenerlo en el ticket", async () => {
    const r0 = await otorgarBeneficio({ customerId: clienteId, kind: "PRODUCTO_GRATIS", variantId: varMaq });
    if (!r0.ok) throw new Error(r0.error);
    const sinProducto = await vender({ lines: [{ variantId: varRopa, qty: 1 }], method: "Efectivo", cashReceived: 60_000, customer: cliente(), benefitId: r0.id });
    expect(sinProducto).toEqual({ ok: false, error: "Agrega al ticket el producto de regalo" });

    const r = await vender({ lines: [{ variantId: varMaq, qty: 1 }], method: "Efectivo", cashReceived: 0, customer: cliente(), benefitId: r0.id });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(0);
    // Gratis: no genera cashback.
    expect(r.cashback).toBe(0);
    const vigentes = await beneficiosParaCaja(clienteId);
    expect(vigentes.some((x) => x.id === r0.id)).toBe(false);
  });

  it("no se canjea el beneficio de otro cliente ni uno vencido", async () => {
    const ajeno = await otorgarBeneficio({ customerId: otroId, kind: "DESCUENTO_CATEGORIA", amount: 20, categoryId: catPadre });
    if (!ajeno.ok) throw new Error(ajeno.error);
    const r = await vender({ lines: [{ variantId: varMaq, qty: 1 }], method: "Datáfono", customer: cliente(), benefitId: ajeno.id });
    expect(r).toEqual({ ok: false, error: "El beneficio es de otro cliente" });

    const viejo = await otorgarBeneficio({
      customerId: clienteId, kind: "DESCUENTO_CATEGORIA", amount: 20, categoryId: catPadre, now: new Date(Date.now() - 31 * 86_400_000),
    });
    if (!viejo.ok) throw new Error(viejo.error);
    const r2 = await vender({ lines: [{ variantId: varMaq, qty: 1 }], method: "Datáfono", customer: cliente(), benefitId: viejo.id });
    expect(r2).toEqual({ ok: false, error: "Ese beneficio ya venció" });
    const lista = await beneficiosDe(clienteId);
    expect(lista.find((x) => x.id === viejo.id)?.estado).toBe("VENCIDO");
    // Vigentes primero.
    expect(lista[0].estado).toBe("VIGENTE");
  });

  it("dos cajas con el mismo beneficio a la vez: exactamente una lo canjea", async () => {
    const r0 = await otorgarBeneficio({ customerId: clienteId, kind: "DESCUENTO_CATEGORIA", amount: 50, categoryId: catPadre });
    if (!r0.ok) throw new Error(r0.error);
    const venta = () => vender({ lines: [{ variantId: varMaq, qty: 1 }], method: "Datáfono", customer: cliente(), benefitId: r0.id });
    const [a, b] = await Promise.all([venta(), venta()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it("sin cliente no hay cashback ni beneficio", async () => {
    const r = await vender({ lines: [{ variantId: varRopa, qty: 1 }], method: "Datáfono" });
    expect(r.ok && r.cashback).toBe(0);
    const r0 = await otorgarBeneficio({ customerId: clienteId, kind: "PRODUCTO_GRATIS", variantId: varRopa });
    if (!r0.ok) throw new Error(r0.error);
    const r2 = await vender({ lines: [{ variantId: varRopa, qty: 1 }], method: "Datáfono", benefitId: r0.id });
    expect(r2).toEqual({ ok: false, error: "Busca al cliente para usar su beneficio" });
  });
});
