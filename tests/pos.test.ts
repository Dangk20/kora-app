// La caja (change s09-pos-caja, S9): vende del MISMO stock que la web.
// Ver openspec/changes/s09-pos-caja — specs/pos-sale.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sellStock, setStockTo, StockError } from "@/modules/inventory/engine";
import { registrarVentaPos as venderEnCaja } from "@/modules/pos/sale";
import { abrirTurno, baseDejada, cerrarTurno, dejarBase, registrarSalida, resumenDeTurno, turnoAbierto } from "@/modules/pos/turno";
import { listPosCatalog } from "@/modules/pos/catalog";

const PREFIJO = "tst-pos-caja";
// Caja propia de las pruebas: no toca la "Caja 1" que alguien tenga abierta
// en pruebas manuales sobre la misma base.
const CAJA_TEST = "Caja test";
const registrarVentaPos = (input: unknown, actorId: string) => venderEnCaja(input, actorId, CAJA_TEST);

async function limpiarTurnos() {
  const turnos = await db.cashSession.findMany({ where: { register: CAJA_TEST }, select: { id: true } });
  const ids = turnos.map((t) => t.id);
  await db.cashMovement.deleteMany({ where: { sessionId: { in: ids } } });
  await db.order.updateMany({ where: { cashSessionId: { in: ids } }, data: { cashSessionId: null } });
  await db.cashSession.deleteMany({ where: { id: { in: ids } } });
}
const SKU_A = "TEST-POS-A-0001";
const SKU_B = "TEST-POS-B-0001";
let adminId = "";
let varA = "";
let varB = "";

const CEL_NUEVO = "3109990001";
const CEL_EXISTE = "3109990002";

async function limpiarClientes() {
  // Las ventas con cliente le acreditan Kora Cashback (3 %): primero sus lotes.
  const where = { customer: { phone: { in: [`+57${CEL_NUEVO}`, `+57${CEL_EXISTE}`] } } };
  await db.benefit.deleteMany({ where });
  await db.cashbackMovement.deleteMany({ where });
  await db.customer.deleteMany({ where: { phone: { in: [`+57${CEL_NUEVO}`, `+57${CEL_EXISTE}`] } } });
}

async function limpiarPedidos() {
  const pedidos = await db.order.findMany({
    where: { channel: "POS", items: { some: { sku: { in: [SKU_A, SKU_B] } } } },
    select: { id: true },
  });
  const ids = pedidos.map((p) => p.id);
  await db.cashbackMovement.deleteMany({ where: { orderId: { in: ids } } });
  await db.salesDocument.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockMovement.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
}

async function stockA(target: number, online = target) {
  await setStockTo({ variantId: varA, target, onlineTarget: online, reason: "AJUSTE_MANUAL", actorId: adminId, note: "test pos" });
}

beforeAll(async () => {
  await limpiarTurnos();
  await limpiarPedidos();
  await limpiarClientes();
  const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
  adminId = admin.id;
  const category = await db.category.findFirstOrThrow();
  const product = await db.product.upsert({
    where: { slug: PREFIJO },
    update: {},
    create: { name: "Test caja POS", slug: PREFIJO, categoryId: category.id, active: true },
  });
  await db.stockMovement.deleteMany({ where: { variant: { sku: { in: [SKU_A, SKU_B] } } } });
  await db.variant.deleteMany({ where: { sku: { in: [SKU_A, SKU_B] } } });
  const precios = { priceCopStore: 34_000, priceCopOnline: 30_000, priceUsdStore: 10, priceUsdOnline: 9 };
  varA = (await db.variant.create({ data: { productId: product.id, sku: SKU_A, barcode: "7700000990011", name: "Única", ...precios } })).id;
  varB = (await db.variant.create({ data: { productId: product.id, sku: SKU_B, name: "Talla M", ...precios, priceCopStore: 16_000 } })).id;
  await stockA(10);
  await setStockTo({ variantId: varB, target: 5, onlineTarget: 0, reason: "COMPRA_INICIAL", actorId: adminId, note: "test pos" });
  const t = await abrirTurno(50_000, adminId, CAJA_TEST);
  expect(t.ok).toBe(true);
});

afterAll(async () => {
  await limpiarTurnos();
  await limpiarPedidos();
  await limpiarClientes();
  await db.stockMovement.deleteMany({ where: { variant: { sku: { in: [SKU_A, SKU_B] } } } });
  await db.variant.deleteMany({ where: { sku: { in: [SKU_A, SKU_B] } } });
  await db.product.deleteMany({ where: { slug: PREFIJO } });
});

describe("venta de mostrador", () => {
  it("descuenta el stock y deja un pedido POS entregado con su comprobante", async () => {
    await stockA(10);
    const r = await registrarVentaPos(
      { lines: [{ variantId: varA, qty: 2 }, { variantId: varB, qty: 1 }], method: "Datáfono" },
      adminId,
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    // Precio de TIENDA (34.000), no el online (30.000).
    expect(r.total).toBe(2 * 34_000 + 16_000);

    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true, salesDocument: true } });
    expect(o.channel).toBe("POS");
    expect(o.status).toBe("DELIVERED");
    expect(o.paymentPreference).toBe("Datáfono");
    expect(o.confirmedAt).not.toBeNull();
    expect(o.salesDocument).not.toBeNull();
    expect(o.salesDocument?.issuedAt.getTime()).toBe(o.confirmedAt?.getTime());

    const a = await db.variant.findUniqueOrThrow({ where: { id: varA } });
    expect(a.stockActual).toBe(8);
    const movs = await db.stockMovement.findMany({ where: { orderId: r.orderId } });
    expect(movs.every((m) => m.reason === "VENTA_POS" && m.channel === "POS")).toBe(true);
  });

  it("no la bloquea el cupo online: recorta el cupo", async () => {
    await stockA(3, 3); // todo el stock publicado online
    const r = await registrarVentaPos({ lines: [{ variantId: varA, qty: 3 }], method: "Transferencia" }, adminId);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const a = await db.variant.findUniqueOrThrow({ where: { id: varA } });
    expect(a.stockActual).toBe(0);
    expect(a.onlineUnits).toBe(0);
  });

  it("rechaza vender más de lo que hay, sin descontar nada", async () => {
    await stockA(1);
    const antesB = (await db.variant.findUniqueOrThrow({ where: { id: varB } })).stockActual;
    const r = await registrarVentaPos(
      { lines: [{ variantId: varB, qty: 1 }, { variantId: varA, qty: 2 }], method: "Transferencia" },
      adminId,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Test caja POS");
    expect((await db.variant.findUniqueOrThrow({ where: { id: varA } })).stockActual).toBe(1);
    expect((await db.variant.findUniqueOrThrow({ where: { id: varB } })).stockActual).toBe(antesB);
  });

  it("efectivo: calcula vueltas y rechaza lo insuficiente", async () => {
    await stockA(5);
    const corto = await registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Efectivo", cashReceived: 20_000 }, adminId);
    expect(corto).toMatchObject({ ok: false });
    const r = await registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Efectivo", cashReceived: 50_000 }, adminId);
    expect(r).toMatchObject({ ok: true, total: 34_000, change: 16_000 });
  });

  it("ignora un precio que venga del navegador", async () => {
    await stockA(5);
    const r = await registrarVentaPos(
      { lines: [{ variantId: varA, qty: 1, unitPrice: 1 } as never], method: "Transferencia" },
      adminId,
    );
    expect(r).toMatchObject({ ok: true, total: 34_000 });
  });

  it("el catálogo de la caja trae el precio de tienda y el código de barras", async () => {
    const { products } = await listPosCatalog();
    const a = products.find((p) => p.sku === SKU_A);
    expect(a).toMatchObject({ price: 34_000, barcode: "7700000990011", variantName: "" });
  });
});

describe("concurrencia cruzada web + POS (DoD de S9)", () => {
  it("sobre la última unidad, exactamente una venta gana", async () => {
    await stockA(1, 1);
    const web = Array.from({ length: 10 }, () =>
      sellStock({ items: [{ variantId: varA, qty: 1 }], channel: "WEB", reason: "VENTA_ONLINE", actorId: adminId }),
    );
    const caja = Array.from({ length: 10 }, () =>
      registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Transferencia" }, adminId),
    );
    const [rWeb, rCaja] = await Promise.all([Promise.allSettled(web), Promise.all(caja)]);

    const ganaWeb = rWeb.filter((r) => r.status === "fulfilled").length;
    const ganaCaja = rCaja.filter((r) => r.ok).length;
    expect(ganaWeb + ganaCaja).toBe(1);
    // Las perdedoras de la web fallan por stock, no por otra cosa.
    for (const r of rWeb) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(StockError);
    }
    const a = await db.variant.findUniqueOrThrow({ where: { id: varA } });
    expect(a.stockActual).toBe(0);
  });
});

describe("el cliente de la venta de caja", () => {
  it("sin datos del cliente, la venta queda a consumidor final y sin ficha", async () => {
    await stockA(5);
    const r = await registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Datáfono" }, adminId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.customerId).toBeNull();
  });

  it("un cliente nuevo queda guardado con origen POS, SIN cuenta", async () => {
    await stockA(5);
    const r = await registrarVentaPos(
      {
        lines: [{ variantId: varA, qty: 1 }],
        method: "Transferencia",
        customer: { name: "Rosa Caja", phone: CEL_NUEVO, document: "1075000111", email: "" },
      },
      adminId,
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const c = await db.customer.findUniqueOrThrow({ where: { phone: `+57${CEL_NUEVO}` } });
    expect(c).toMatchObject({ name: "Rosa Caja", source: "POS", document: "1075000111", passwordHash: null });
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.customerId).toBe(c.id);
    expect(o.contactPhone).toBe(`+57${CEL_NUEVO}`);
  });

  it("un cliente que ya existe se ata por celular y la caja completa su cédula", async () => {
    await stockA(5);
    const existente = await db.customer.create({ data: { name: "Laura Web", phone: `+57${CEL_EXISTE}`, source: "WEB" } });
    const r = await registrarVentaPos(
      {
        lines: [{ variantId: varA, qty: 1 }],
        method: "Datáfono",
        customer: { name: "Laura Web", phone: `${CEL_EXISTE.slice(0, 3)} ${CEL_EXISTE.slice(3)}`, document: "52000999" },
      },
      adminId,
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.customerId).toBe(existente.id);
    const c = await db.customer.findUniqueOrThrow({ where: { id: existente.id } });
    expect(c.document).toBe("52000999");
    expect(c.source).toBe("WEB"); // no se reescribe el origen
    expect(await db.customer.count({ where: { phone: `+57${CEL_EXISTE}` } })).toBe(1);
  });

  it("rechaza un celular inválido", async () => {
    const r = await registrarVentaPos(
      { lines: [{ variantId: varA, qty: 1 }], method: "Datáfono", customer: { name: "Sin cel", phone: "123" } },
      adminId,
    );
    expect(r.ok).toBe(false);
  });
});

describe("turno de caja", () => {
  it("no se puede abrir dos veces la misma caja", async () => {
    const r = await abrirTurno(10_000, adminId, CAJA_TEST);
    expect(r).toMatchObject({ ok: false });
  });

  it("las ventas, las salidas y la base dan el efectivo esperado del cierre, y la base pasa al día siguiente", async () => {
    // Un turno limpio para este escenario.
    const abierto = await turnoAbierto(CAJA_TEST);
    await cerrarTurno(abierto!.id, adminId);
    const t = await abrirTurno(100_000, adminId, CAJA_TEST);
    expect(t.ok).toBe(true);
    if (!t.ok) return;

    await stockA(10);
    await registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Efectivo", cashReceived: 50_000 }, adminId); // 34.000
    await registrarVentaPos({ lines: [{ variantId: varA, qty: 2 }], method: "Datáfono" }, adminId); // 68.000
    await registrarVentaPos({ lines: [{ variantId: varB, qty: 1 }], method: "Transferencia" }, adminId); // 16.000
    expect((await registrarSalida(12_000, "Bolsas para la tienda", adminId, CAJA_TEST)).ok).toBe(true);
    expect(await registrarSalida(0, "nada", adminId, CAJA_TEST)).toMatchObject({ ok: false });

    const previo = await resumenDeTurno(t.id);
    expect(previo).toMatchObject({ ventas: 3, total: 118_000, base: 100_000, totalSalidas: 12_000 });
    // Base + efectivo − salidas.
    expect(previo!.efectivoEnCaja).toBe(100_000 + 34_000 - 12_000);
    expect(previo!.porMetodo.map((m) => [m.metodo, m.monto])).toEqual([
      ["Efectivo", 34_000],
      ["Datáfono", 68_000],
      ["Transferencia", 16_000],
    ]);

    const cierre = await cerrarTurno(t.id, adminId);
    expect(cierre.ok).toBe(true);
    expect(await cerrarTurno(t.id, adminId)).toMatchObject({ ok: false }); // ya cerrada

    // Cerrada la caja: no se vende ni se registran salidas.
    const sinCaja = await registrarVentaPos({ lines: [{ variantId: varA, qty: 1 }], method: "Datáfono" }, adminId);
    expect(sinCaja).toMatchObject({ ok: false });
    expect(await registrarSalida(5_000, "Domicilio", adminId, CAJA_TEST)).toMatchObject({ ok: false });

    // La base que se deja es la que el siguiente turno ve.
    expect((await dejarBase(t.id, 80_000)).ok).toBe(true);
    expect(await baseDejada(CAJA_TEST)).toBe(80_000);
    expect((await dejarBase(t.id, null)).ok).toBe(true);
    expect(await baseDejada(CAJA_TEST)).toBeNull();

    // Se deja abierta para el resto de pruebas.
    expect((await abrirTurno(0, adminId, CAJA_TEST)).ok).toBe(true);
  });
});
