// Recoger en tienda o envío, por el camino REAL de crear el pedido.
// Ver openspec/changes/entrega-recoger-o-envio — specs/checkout-delivery.
//
// La primera pregunta del checkout es cómo se recibe el pedido. Recoger es
// SOLO EN NEIVA: no pide dirección y guarda a quien recoge en los ship*.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `createOrder` lee la moneda y la sesión del comprador de las cookies de
// Next. Aquí no hay petición: se simulan con un mapa que cada prueba ajusta.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));

import { db } from "@/lib/db";
import { setStockTo } from "@/modules/inventory/engine";
import { createOrder } from "@/modules/orders/checkout-actions";
import { buildWhatsappMessage } from "@/modules/orders/message";
import { buildSnapshot } from "@/modules/invoicing/snapshot";
import { bloquesDePartes } from "@/modules/invoicing/pdf";
import { tiendaFisica } from "@/modules/orders/tienda-fisica";

const PREFIJO = "tst-entrega-recoger";
const SKU = "TEST-ENTREGA-RECOGER-0001";
let variantId = "";

const PAGADOR_CO = {
  country: "CO" as const,
  name: "Laura Gómez",
  email: `${PREFIJO}-laura@ejemplo.com`,
  phone: "300 123 4567",
  document: "1020304050",
  documentType: "CC",
  address: "Carrera 7 # 82 - 15",
  address2: "Apto 402",
  city: "BOGOTÁ D.C.",
  state: "Bogotá D.C.",
  neighborhood: "Chapinero",
  zip: "",
};

const PAGADOR_US = {
  country: "US" as const,
  name: "John Smith",
  email: `${PREFIJO}-john@example.com`,
  phone: "(305) 555-0123",
  document: "",
  documentType: "",
  address: "123 Main St",
  address2: "Apt 4B",
  city: "Miami",
  state: "FL",
  neighborhood: "",
  zip: "33101",
};

function formulario(extra: Record<string, unknown>) {
  return {
    checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
    // Desde el 17 oct 2026 la primera pregunta es el método de entrega
    // (change entrega-recoger-o-envio). Este archivo prueba el envío.
    deliveryMethod: "SHIPPING",
    couponCode: "",
    cashbackRequested: 0,
    paymentPreference: "Nequi",
    acceptsData: true,
    acceptsMarketing: false,
    ...extra,
  };
}

async function limpiar() {
  const pedidos = await db.order.findMany({
    where: { checkoutToken: { startsWith: PREFIJO } },
    select: { id: true, customerId: true },
  });
  const ids = pedidos.map((p) => p.id);
  for (const id of ids) {
    await db.domainEvent.deleteMany({ where: { payload: { path: ["orderId"], equals: id } } });
  }
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  const clientes = await db.customer.findMany({
    where: { email: { startsWith: PREFIJO } },
    select: { id: true },
  });
  await db.customer.deleteMany({ where: { id: { in: clientes.map((c) => c.id) } } });
}

beforeAll(async () => {
  await limpiar();
  const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
  const category = await db.category.findFirstOrThrow();
  const product = await db.product.upsert({
    where: { slug: PREFIJO },
    update: {},
    create: { name: "Test recoger o envío", slug: PREFIJO, categoryId: category.id, active: true },
  });
  await db.stockMovement.deleteMany({ where: { variant: { sku: SKU } } });
  await db.variant.deleteMany({ where: { sku: SKU } });
  const v = await db.variant.create({
    data: {
      productId: product.id,
      sku: SKU,
      name: "Única",
      priceCopStore: 50_000,
      priceCopOnline: 50_000,
      priceUsdStore: 15,
      priceUsdOnline: 15,
    },
  });
  variantId = v.id;
  await setStockTo({
    variantId: v.id,
    target: 50,
    onlineTarget: 50,
    reason: "COMPRA_INICIAL",
    actorId: admin.id,
    note: "setup de test",
  });
});

afterAll(async () => {
  await limpiar();
  await db.stockMovement.deleteMany({ where: { variant: { sku: SKU } } });
  await db.variant.deleteMany({ where: { sku: SKU } });
  await db.product.deleteMany({ where: { slug: PREFIJO } });
});

const carrito = () => [{ variantId, qty: 1 }];

async function pedidoCreado(numeroFormateado: string) {
  const numero = Number(numeroFormateado.split("-").at(-1));
  return db.order.findFirstOrThrow({ where: { number: numero } });
}

describe("la primera pregunta: cómo se recibe", () => {
  it("rechaza un pedido sin método de entrega", async () => {
    cookieJar.set("kora_moneda", "COP");
    const { deliveryMethod: _sinMetodo, ...sinMetodo } = formulario({ billing: PAGADOR_CO, shipSameAsBilling: true });
    void _sinMetodo;
    const r = await createOrder(carrito(), sinMetodo);
    expect(r).toMatchObject({ ok: false, field: "deliveryMethod" });
  });

  it("el envío sigue igual y queda SHIPPING", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(carrito(), formulario({ billing: PAGADOR_CO, shipSameAsBilling: true }));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const o = await pedidoCreado(r.orderNumber);
    expect(o.deliveryMethod).toBe("SHIPPING");
    expect(o.shipAddress).toBe(o.billAddress);
    expect(o.whatsappMessage).toContain("📍 Entrega");
  });
});

describe("recoger en tienda", () => {
  it("lo recoge quien paga: sin dirección, en Neiva", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(
      carrito(),
      formulario({ deliveryMethod: "PICKUP", pickupByPayer: true, billing: PAGADOR_CO }),
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;

    const o = await pedidoCreado(r.orderNumber);
    expect(o.deliveryMethod).toBe("PICKUP");
    expect(o.shipSameAsBilling).toBe(false);
    expect(o.shipName).toBe("Laura Gómez");
    expect(o.shipPhone).toBe("+573001234567");
    expect(o.shipDocument).toBe("CC 1020304050");
    expect(o.shipCountry).toBe("CO");
    expect(o.shipCity).toBe("Neiva");
    expect(o.shipAddress).toBeNull();
    expect(o.shipNeighborhood).toBeNull();
    // La facturación sigue completa.
    expect(o.billAddress).toBe("Carrera 7 # 82 - 15");
    expect(o.whatsappMessage).toContain("🏬 Recoger en tienda (Neiva)");
    expect(o.whatsappMessage).not.toContain("📍");
    expect(o.whatsappMessage).not.toContain("💳 Paga");
  });

  it("desde EE.UU. recoge un familiar en Neiva", async () => {
    cookieJar.set("kora_moneda", "USD");
    const r = await createOrder(
      carrito(),
      formulario({
        deliveryMethod: "PICKUP",
        billing: PAGADOR_US,
        pickup: { name: "Rosa Smith", phone: "310 987 6543", document: "" },
      }),
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;

    const o = await pedidoCreado(r.orderNumber);
    expect(o.deliveryMethod).toBe("PICKUP");
    expect(o.contactName).toBe("John Smith");
    expect(o.billCountry).toBe("US");
    expect(o.shipName).toBe("Rosa Smith");
    expect(o.shipPhone).toBe("+573109876543");
    expect(o.shipDocument).toBeNull();
    expect(o.shipAddress).toBeNull();
    expect(o.whatsappMessage).toContain("💳 Paga");
    expect(o.whatsappMessage).toContain("👤 Recoge: Rosa Smith");
  });

  it("'lo recojo yo' exige que el pagador esté en Colombia", async () => {
    cookieJar.set("kora_moneda", "USD");
    const r = await createOrder(
      carrito(),
      formulario({ deliveryMethod: "PICKUP", pickupByPayer: true, billing: PAGADOR_US }),
    );
    expect(r).toMatchObject({ ok: false, field: "pickup.name" });
  });

  it("señala el celular inválido de quien recoge", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(
      carrito(),
      formulario({
        deliveryMethod: "PICKUP",
        billing: PAGADOR_CO,
        pickup: { name: "Rosa Smith", phone: "12345", document: "" },
      }),
    );
    expect(r).toMatchObject({ ok: false, field: "pickup.phone" });
  });

  it("no pide un bloque de envío aunque llegue vacío", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(
      carrito(),
      formulario({ deliveryMethod: "PICKUP", pickupByPayer: true, billing: PAGADOR_CO, shipping: undefined }),
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
});

describe("cada consumidor dice cómo se entrega", () => {
  it("el mensaje de WhatsApp de una recogida no lleva dirección", () => {
    const m = buildWhatsappMessage({
      orderNumber: "KORA-2026-0001",
      currency: "COP",
      items: [{ qty: 1, productName: "Máscara", variantName: "Única", unitPrice: 17_600, lineTotal: 17_600 }],
      total: 17_600,
      contactName: "Laura Gómez",
      contactPhone: "+573001234567",
      address: [],
      pickup: { city: "Neiva" },
      paymentPreference: "Nequi",
    });
    expect(m).toContain("🏬 Recoger en tienda (Neiva)");
    expect(m).not.toContain("📍");
  });

  it("el comprobante dice RECOGER EN TIENDA y quién recoge", async () => {
    const o = await db.order.findFirstOrThrow({
      where: { checkoutToken: { startsWith: PREFIJO }, deliveryMethod: "PICKUP", shipName: "Rosa Smith" },
      include: { items: true },
    });
    const partes = bloquesDePartes(buildSnapshot(o, new Date()));
    expect(partes.derecha?.titulo).toBe("RECOGER EN TIENDA");
    expect(partes.derecha?.lineas[0]).toBe("Tienda KORA · Neiva");
    expect(partes.derecha?.lineas).toContain("Recoge: Rosa Smith");
  });

  it("un comprobante anterior, sin método, se dibuja como envío", async () => {
    const o = await db.order.findFirstOrThrow({
      where: { checkoutToken: { startsWith: PREFIJO }, deliveryMethod: "SHIPPING" },
      include: { items: true },
    });
    const snap = buildSnapshot(o, new Date());
    delete snap.delivery; // como se emitía antes del 17 oct 2026
    expect(bloquesDePartes(snap).derecha?.titulo).toBe("ENVIAR A");
  });
});

describe("la tienda de Neiva", () => {
  it("usa la dirección y el horario confirmados", () => {
    const t = tiendaFisica({} as NodeJS.ProcessEnv);
    expect(t.direccion).toBe("Calle 25 Sur # 32-23, Neiva, Huila");
    expect(t.horario).toContain("9:00 a. m. a 6:00 p. m.");
  });

  it("el entorno los cambia, y en blanco se confirman por WhatsApp", () => {
    const otra = tiendaFisica({ KORA_TIENDA_DIRECCION: "Otra dirección" } as unknown as NodeJS.ProcessEnv);
    expect(otra.direccion).toBe("Otra dirección");
    const vacia = tiendaFisica({ KORA_TIENDA_DIRECCION: " ", KORA_TIENDA_HORARIO: "" } as unknown as NodeJS.ProcessEnv);
    expect(vacia.direccion).toBeNull();
    expect(vacia.horario).toBeNull();
  });
});
