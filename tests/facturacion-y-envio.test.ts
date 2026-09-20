// Quién paga y a quién se envía, por el camino REAL de crear el pedido.
// Ver openspec/changes/direccion-facturacion-y-envio — specs/checkout-addresses.
//
// KORA no envía a EE.UU.: quien compra en USD está allá y manda el pedido a un
// familiar en Colombia. El pedido guarda las dos direcciones como snapshot.
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

const PREFIJO = "tst-facturacion-envio";
const SKU = "TEST-FACT-ENVIO-0001";
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

const DESTINATARIO_CO = {
  country: "CO" as const,
  name: "Rosa Smith",
  phone: "310 987 6543",
  document: "",
  address: "Calle 10 # 5 - 20",
  address2: "",
  city: "Cali",
  state: "Valle del Cauca",
  neighborhood: "San Antonio",
  zip: "",
  notes: "Dejar en portería",
};

function formulario(extra: Record<string, unknown>) {
  return {
    checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
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
    create: { name: "Test facturación y envío", slug: PREFIJO, categoryId: category.id, active: true },
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

describe("compra desde Colombia para uno mismo", () => {
  it("copia la facturación al envío y lo marca como misma dirección", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(carrito(), formulario({ billing: PAGADOR_CO, shipSameAsBilling: true }));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;

    const o = await pedidoCreado(r.orderNumber);
    expect(o.shipSameAsBilling).toBe(true);
    expect(o.billCountry).toBe("CO");
    expect(o.billCity).toBe("Bogotá D.C."); // canonizada desde "BOGOTÁ D.C."
    expect(o.billNeighborhood).toBe("Chapinero");
    expect(o.shipCountry).toBe("CO");
    expect(o.shipName).toBe("Laura Gómez");
    expect(o.shipPhone).toBe("+573001234567");
    expect(o.shipDocument).toBe("CC 1020304050");
    expect(o.shipAddress).toBe(o.billAddress);
    expect(o.shipCity).toBe(o.billCity);
    // El mensaje queda como siempre: sin bloque de destinatario.
    expect(o.whatsappMessage).not.toContain("Enviar a");
    expect(o.whatsappMessage).toContain("📍 Entrega");
  });

  it("'misma dirección' exige que el pagador esté en Colombia", async () => {
    cookieJar.set("kora_moneda", "USD");
    const r = await createOrder(carrito(), formulario({ billing: PAGADOR_US, shipSameAsBilling: true }));
    expect(r).toMatchObject({ ok: false, field: "shipping.name" });
  });
});

describe("compra desde Colombia para otra persona", () => {
  it("guarda al destinatario con su propio contacto", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(
      carrito(),
      formulario({ billing: PAGADOR_CO, shipSameAsBilling: false, shipping: DESTINATARIO_CO }),
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;

    const o = await pedidoCreado(r.orderNumber);
    expect(o.shipSameAsBilling).toBe(false);
    expect(o.contactName).toBe("Laura Gómez");
    expect(o.shipName).toBe("Rosa Smith");
    expect(o.shipPhone).toBe("+573109876543");
    expect(o.shipDocument).toBeNull(); // opcional
    expect(o.shipCity).toBe("Cali");
    expect(o.shipNotes).toBe("Dejar en portería");
    expect(o.whatsappMessage).toContain("💳 Paga");
    expect(o.whatsappMessage).toContain("📍 Enviar a");
    expect(o.whatsappMessage).toContain("👤 Rosa Smith");
  });

  it("el celular del destinatario tiene que tener 10 dígitos", async () => {
    cookieJar.set("kora_moneda", "COP");
    const r = await createOrder(
      carrito(),
      formulario({
        billing: PAGADOR_CO,
        shipSameAsBilling: false,
        shipping: { ...DESTINATARIO_CO, phone: "310 98" },
      }),
    );
    expect(r).toMatchObject({ ok: false, field: "shipping.phone" });
  });
});

describe("compra desde Estados Unidos para un familiar en Colombia", () => {
  it("facturación en EE.UU., envío en Colombia, moneda USD", async () => {
    cookieJar.set("kora_moneda", "USD");
    const r = await createOrder(
      carrito(),
      formulario({ billing: PAGADOR_US, shipSameAsBilling: false, shipping: DESTINATARIO_CO }),
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;

    const o = await pedidoCreado(r.orderNumber);
    expect(o.currency).toBe("USD");
    expect(o.contactPhone).toBe("+13055550123");
    expect(o.contactDocument).toBeNull();
    expect(o.billCountry).toBe("US");
    expect(o.billState).toBe("FL");
    expect(o.billZip).toBe("33101");
    expect(o.billNeighborhood).toBeNull();
    expect(o.shipCountry).toBe("CO");
    expect(o.shipName).toBe("Rosa Smith");
    expect(o.shipZip).toBeNull();

    // El cliente lleva el país del PAGADOR y la dirección de ENVÍO estrena su libreta.
    const cliente = await db.customer.findUniqueOrThrow({
      where: { id: o.customerId! },
      include: { addresses: true },
    });
    expect(cliente.country).toBe("US");
    expect(cliente.addresses).toHaveLength(1);
    expect(cliente.addresses[0]).toMatchObject({ country: "CO", city: "Cali", isDefault: true });
  });

  it("un envío fuera de Colombia se rechaza en el esquema", async () => {
    cookieJar.set("kora_moneda", "USD");
    const r = await createOrder(
      carrito(),
      formulario({
        billing: PAGADOR_US,
        shipSameAsBilling: false,
        shipping: { ...DESTINATARIO_CO, country: "US", state: "FL", city: "Miami", zip: "33101" },
      }),
    );
    expect(r).toMatchObject({ ok: false, field: "shipping.country" });
  });
});
