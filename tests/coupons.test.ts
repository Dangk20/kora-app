// Cupones. Un cupón es dinero que sale: estas reglas se fijan con prueba.
//   1. El estado se DERIVA con una precedencia fija — panel y checkout deben
//      coincidir siempre sobre si un cupón sirve.
//   2. Las siete validaciones tienen ORDEN: el mensaje es lo único que el
//      comprador ve, y decirle el motivo equivocado lo manda a arreglar lo que
//      no está roto.
//   3. Las dos monedas no se convierten. Nunca.
//   4. El descuento jamás deja el total negativo.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { ResolvedCart, ResolvedLine } from "@/modules/cart/resolve";
import { computeDiscount, eligibleLines, fixedAmountFor, type CouponForDiscount } from "@/modules/coupons/discount";
import { rejectionMessage } from "@/modules/coupons/messages";
import { couponStatus } from "@/modules/coupons/status";
import { validateCoupon } from "@/modules/coupons/validate";

const PREFIJO = "ZZT";

async function limpiar() {
  const ids = (
    await db.coupon.findMany({ where: { code: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.couponRedemption.deleteMany({ where: { couponId: { in: ids } } });
  await db.couponCategory.deleteMany({ where: { couponId: { in: ids } } });
  await db.couponProduct.deleteMany({ where: { couponId: { in: ids } } });
  await db.coupon.deleteMany({ where: { id: { in: ids } } });
}

let n = 0;
async function cupon(over: Record<string, unknown> = {}) {
  n += 1;
  return db.coupon.create({
    data: {
      code: `${PREFIJO}${n}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: "Cupón de prueba",
      type: "PERCENT",
      percentValue: 10,
      ...over,
    },
  });
}

function linea(over: Partial<ResolvedLine> = {}): ResolvedLine {
  return {
    variantId: "v1",
    productId: "p1",
    categoryId: "c1",
    qty: 1,
    qtyAvailable: 1,
    productName: "Producto",
    productSlug: "producto",
    variantName: "Única",
    sku: "SKU1",
    imageUrl: null,
    categoryColor: "#000",
    categoryIcon: "box",
    unitPrice: 100_000,
    storeUnitPrice: 100_000,
    hasOnlineDiscount: false,
    lineTotal: 100_000,
    onlineUnits: 10,
    unavailable: false,
    ...over,
  };
}

function carrito(lines: ResolvedLine[], currency: "COP" | "USD" = "COP"): ResolvedCart {
  return {
    lines,
    currency,
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    itemCount: lines.reduce((s, l) => s + l.qtyAvailable, 0),
    hasIssues: false,
  };
}

const base: CouponForDiscount = {
  type: "PERCENT",
  percentValue: 10,
  amountCop: null,
  amountUsd: null,
  scope: "ALL",
  categoryIds: [],
  productIds: [],
  appliesToSaleItems: true,
};

beforeEach(limpiar);
afterEach(limpiar);

describe("estado derivado", () => {
  const activo = { active: true, validTo: null, maxUses: null, usedCount: 0 };

  it("pausado gana sobre vencido", () => {
    // Si el operador lo pausó, quiere leer "Inactivo" — no "Vencido".
    const ayer = new Date(Date.now() - 86_400_000);
    expect(couponStatus({ ...activo, active: false, validTo: ayer })).toBe("INACTIVE");
  });

  it("vencido gana sobre agotado", () => {
    const ayer = new Date(Date.now() - 86_400_000);
    expect(couponStatus({ ...activo, validTo: ayer, maxUses: 1, usedCount: 5 })).toBe("EXPIRED");
  });

  it("agotado cuando los usos alcanzan el máximo", () => {
    expect(couponStatus({ ...activo, maxUses: 3, usedCount: 3 })).toBe("EXHAUSTED");
    expect(couponStatus({ ...activo, maxUses: 3, usedCount: 2 })).toBe("ACTIVE");
  });

  it("sin vencimiento ni máximo, activo indefinidamente", () => {
    expect(couponStatus(activo)).toBe("ACTIVE");
  });
});

describe("cálculo del descuento", () => {
  it("porcentaje sobre el subtotal elegible", () => {
    const r = computeDiscount({ ...base, percentValue: 20 }, carrito([linea()]));
    expect(r.amount).toBe(20_000);
  });

  it("el monto fijo NUNCA deja el total negativo", () => {
    // Un cupón no genera saldo a favor: en un cobro por WhatsApp nadie sabría
    // qué hacer con él.
    const c = { ...base, type: "FIXED" as const, percentValue: null, amountCop: 500_000 };
    const r = computeDiscount(c, carrito([linea({ lineTotal: 100_000 })]));
    expect(r.amount).toBe(100_000);
  });

  it("NO convierte entre monedas", () => {
    const c = { ...base, type: "FIXED" as const, percentValue: null, amountCop: 10_000, amountUsd: 5 };
    expect(fixedAmountFor(c, "COP")).toBe(10_000);
    expect(fixedAmountFor(c, "USD")).toBe(5); // no 10.000/tasa
  });

  it("un cupón de una sola moneda no aplica a la otra", () => {
    const c = { ...base, type: "FIXED" as const, percentValue: null, amountCop: 10_000, amountUsd: null };
    expect(fixedAmountFor(c, "COP")).toBe(10_000);
    expect(fixedAmountFor(c, "USD")).toBeNull();
  });

  it("en pesos trunca a la unidad; en dólares al centavo", () => {
    // Truncar hacia abajo: un peso de más a favor del comprador, en un cobro
    // fuera de la plataforma, es una discusión.
    const cop = computeDiscount({ ...base, percentValue: 33 }, carrito([linea({ lineTotal: 10_001 })]));
    expect(Number.isInteger(cop.amount)).toBe(true);
    const usd = computeDiscount(
      { ...base, percentValue: 33 },
      carrito([linea({ lineTotal: 10.01 })], "USD"),
    );
    expect(usd.amount).toBeCloseTo(3.3, 2);
  });

  it("el producto gratis no descuenta importe", () => {
    // Entra como línea con precio cero, para que su stock lo descuente el motor.
    const r = computeDiscount({ ...base, type: "FREE_PRODUCT" }, carrito([linea()]));
    expect(r.amount).toBe(0);
  });
});

describe("elegibilidad por alcance", () => {
  it("todo el catálogo incluye todas las líneas", () => {
    const c = carrito([linea({ categoryId: "a" }), linea({ variantId: "v2", categoryId: "b" })]);
    expect(eligibleLines(base, c)).toHaveLength(2);
  });

  it("por categoría deja fuera lo que no es de ella", () => {
    const c = carrito([linea({ categoryId: "a" }), linea({ variantId: "v2", categoryId: "b" })]);
    const cupon = { ...base, scope: "CATEGORIES" as const, categoryIds: ["a"] };
    const eleg = eligibleLines(cupon, c);
    expect(eleg).toHaveLength(1);
    expect(eleg[0].categoryId).toBe("a");
  });

  it("por producto deja fuera lo que no es de él", () => {
    const c = carrito([linea({ productId: "p1" }), linea({ variantId: "v2", productId: "p2" })]);
    const cupon = { ...base, scope: "PRODUCTS" as const, productIds: ["p2"] };
    expect(eligibleLines(cupon, c).map((l) => l.productId)).toEqual(["p2"]);
  });

  it("con el interruptor apagado, los ítems en oferta quedan fuera", () => {
    const c = carrito([
      linea({ hasOnlineDiscount: true }),
      linea({ variantId: "v2", hasOnlineDiscount: false }),
    ]);
    expect(eligibleLines({ ...base, appliesToSaleItems: false }, c)).toHaveLength(1);
  });

  it("un carrito enteramente en oferta con el interruptor apagado deja cero elegibles", () => {
    // Cero elegibles es un RECHAZO, no un descuento de cero.
    const c = carrito([linea({ hasOnlineDiscount: true })]);
    expect(eligibleLines({ ...base, appliesToSaleItems: false }, c)).toHaveLength(0);
  });

  it("las líneas no disponibles nunca son elegibles", () => {
    const c = carrito([linea({ unavailable: true }), linea({ variantId: "v2", qtyAvailable: 0 })]);
    expect(eligibleLines(base, c)).toHaveLength(0);
  });
});

describe("validación: orden y motivos", () => {
  const contacto = { phone: "+573001112233", email: "nadie@ejemplo.com" };

  it("un cupón inexistente da NOT_FOUND", async () => {
    const r = await validateCoupon("ZZTNOEXISTE", carrito([linea()]), contacto, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("NOT_FOUND");
  });

  it("pausado Y vencido da el motivo de la PRIMERA comprobación", async () => {
    // Es lo que hace que el orden importe: decirle "vencido" a alguien cuyo
    // cupón el negocio pausó a propósito es una explicación equivocada.
    const c = await cupon({ active: false, validTo: new Date(Date.now() - 86_400_000) });
    const r = await validateCoupon(c.code, carrito([linea()]), contacto, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("NOT_FOUND");
  });

  it("vencido da NOT_IN_WINDOW", async () => {
    const c = await cupon({ validTo: new Date(Date.now() - 86_400_000) });
    const r = await validateCoupon(c.code, carrito([linea()]), contacto, db);
    if (!r.ok) expect(r.reason).toBe("NOT_IN_WINDOW");
  });

  it("todavía no vigente también da NOT_IN_WINDOW", async () => {
    const c = await cupon({ validFrom: new Date(Date.now() + 86_400_000) });
    const r = await validateCoupon(c.code, carrito([linea()]), contacto, db);
    if (!r.ok) expect(r.reason).toBe("NOT_IN_WINDOW");
  });

  it("agotado da EXHAUSTED", async () => {
    const c = await cupon({ maxUses: 2, usedCount: 2 });
    const r = await validateCoupon(c.code, carrito([linea()]), contacto, db);
    if (!r.ok) expect(r.reason).toBe("EXHAUSTED");
  });

  it("moneda no aplicable da CURRENCY, y el mensaje la nombra", async () => {
    const c = await cupon({ type: "FIXED", percentValue: null, amountCop: 10_000 });
    const r = await validateCoupon(c.code, carrito([linea()], "USD"), contacto, db);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("CURRENCY");
      expect(r.message).toContain("USD");
    }
  });

  it("un porcentaje aplica a cualquier moneda", async () => {
    const c = await cupon({ percentValue: 15 });
    const r = await validateCoupon(c.code, carrito([linea()], "USD"), contacto, db);
    expect(r.ok).toBe(true);
  });

  it("sin ítems elegibles da NO_ELIGIBLE_ITEMS", async () => {
    const c = await cupon({ scope: "CATEGORIES" }); // sin categorías asociadas
    const r = await validateCoupon(c.code, carrito([linea()]), contacto, db);
    if (!r.ok) expect(r.reason).toBe("NO_ELIGIBLE_ITEMS");
  });

  it("un cupón válido devuelve el descuento calculado", async () => {
    const c = await cupon({ percentValue: 25 });
    const r = await validateCoupon(c.code, carrito([linea({ lineTotal: 40_000 })]), contacto, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(10_000);
  });

  it("el código se normaliza a mayúsculas al buscarlo", async () => {
    const c = await cupon();
    const r = await validateCoupon(c.code.toLowerCase(), carrito([linea()]), contacto, db);
    expect(r.ok).toBe(true);
  });
});

describe("mensajes exactos de la historia de usuario", () => {
  it("son los siete literales", () => {
    expect(rejectionMessage("NOT_FOUND")).toBe("Cupón no válido.");
    expect(rejectionMessage("NOT_IN_WINDOW")).toBe("Este cupón no está vigente.");
    expect(rejectionMessage("EXHAUSTED")).toBe("Este cupón ya alcanzó su límite de usos.");
    expect(rejectionMessage("CURRENCY", "COP")).toBe("Este cupón no aplica para compras en COP.");
    expect(rejectionMessage("NO_ELIGIBLE_ITEMS")).toBe(
      "Este cupón no aplica a los productos de tu carrito.",
    );
    expect(rejectionMessage("FIRST_PURCHASE_ONLY")).toBe("Este cupón es solo para tu primera compra.");
    expect(rejectionMessage("PER_CUSTOMER_LIMIT")).toBe(
      "Ya usaste este cupón el máximo de veces permitido.",
    );
  });
});

describe("consumo del uso — la parte que cuesta dinero", () => {
  it("el incremento condicional NO deja pasar dos usos sobre un cupón de uno", async () => {
    // Es el equivalente aquí del test de las 50 compras sobre stock=1: leer,
    // comprobar y luego escribir dejaría una ventana en la que dos compradores
    // con el último uso verían ambos que queda uno.
    const c = await cupon({ maxUses: 1 });

    const intentar = () =>
      db.$executeRaw`
        UPDATE coupons
        SET "usedCount" = "usedCount" + 1
        WHERE id = ${c.id} AND active = true
          AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
      `;

    const resultados = await Promise.all([intentar(), intentar(), intentar()]);
    const ganadores = resultados.filter((filas) => filas === 1).length;

    expect(ganadores).toBe(1);
    const despues = await db.coupon.findUniqueOrThrow({ where: { id: c.id } });
    expect(despues.usedCount).toBe(1);
  });

  it("un cupón pausado no puede consumirse aunque quede cupo", async () => {
    const c = await cupon({ maxUses: 10, active: false });
    const filas = await db.$executeRaw`
      UPDATE coupons SET "usedCount" = "usedCount" + 1
      WHERE id = ${c.id} AND active = true
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
    expect(filas).toBe(0);
  });

  it("un cupón sin máximo se puede consumir siempre", async () => {
    const c = await cupon({ maxUses: null });
    const filas = await db.$executeRaw`
      UPDATE coupons SET "usedCount" = "usedCount" + 1
      WHERE id = ${c.id} AND active = true
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
    expect(filas).toBe(1);
  });
});
