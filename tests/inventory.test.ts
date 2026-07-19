// EL TEST DE ACEPTACIÓN DEL PROYECTO (plan técnico §2.2):
// 50 requests simultáneas sobre stock=1 → exactamente 1 gana, 49 "agotado".
// Si este test no pasa, no se avanza.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  findLedgerMismatches,
  sellStock,
  setStockTo,
  StockError,
} from "@/modules/inventory/engine";

const SKU = "TEST-CONC-0001";
const SKU_B = "TEST-CONC-0002";

async function createTestVariant(sku: string, stock: number) {
  const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
  const category = await db.category.findFirstOrThrow();
  const product = await db.product.upsert({
    where: { slug: `test-concurrencia-${sku.toLowerCase()}` },
    update: {},
    create: {
      name: `Test concurrencia ${sku}`,
      slug: `test-concurrencia-${sku.toLowerCase()}`,
      categoryId: category.id,
      active: false, // nunca visible en la tienda
    },
  });
  await db.stockMovement.deleteMany({ where: { variant: { sku } } });
  await db.variant.deleteMany({ where: { sku } });
  const variant = await db.variant.create({
    data: {
      productId: product.id,
      sku,
      name: "Única",
      priceCopStore: 1000,
      priceCopOnline: 1000,
      priceUsdStore: 1,
      priceUsdOnline: 1,
    },
  });
  if (stock > 0) {
    await setStockTo({
      variantId: variant.id,
      target: stock,
      reason: "COMPRA_INICIAL",
      actorId: admin.id,
      note: "setup de test",
    });
  }
  return variant;
}

async function cleanup() {
  await db.stockMovement.deleteMany({
    where: { variant: { sku: { in: [SKU, SKU_B] } } },
  });
  await db.variant.deleteMany({ where: { sku: { in: [SKU, SKU_B] } } });
  await db.product.deleteMany({ where: { slug: { startsWith: "test-concurrencia-" } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("motor de inventario — anti-sobreventa", () => {
  it("50 compradores simultáneos por la última unidad: exactamente 1 gana", async () => {
    const variant = await createTestVariant(SKU, 1);

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        sellStock({
          items: [{ variantId: variant.id, qty: 1 }],
          channel: i % 2 === 0 ? "WEB" : "POS", // mitad web, mitad POS: el caso real
          reason: i % 2 === 0 ? "VENTA_ONLINE" : "VENTA_POS",
        }),
      ),
    );

    const wins = results.filter((r) => r.status === "fulfilled").length;
    const losses = results.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof StockError &&
        r.reason.code === "INSUFFICIENT",
    ).length;

    expect(wins).toBe(1);
    expect(losses).toBe(49);

    const final = await db.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(final.stockActual).toBe(0);

    // El libro contable cuadra: 1 entrada (+1) y 1 venta (-1), nada más.
    const movements = await db.stockMovement.findMany({
      where: { variantId: variant.id },
    });
    expect(movements).toHaveLength(2);
    expect(movements.reduce((s, m) => s + m.delta, 0)).toBe(0);
  }, 60_000);

  it("venta multi-ítem es atómica: si un ítem no alcanza, no se descuenta nada", async () => {
    const a = await createTestVariant(SKU, 5);
    const b = await createTestVariant(SKU_B, 1);

    await expect(
      sellStock({
        items: [
          { variantId: a.id, qty: 2 },
          { variantId: b.id, qty: 3 }, // no hay
        ],
        channel: "WEB",
        reason: "VENTA_ONLINE",
      }),
    ).rejects.toThrow(StockError);

    const [finalA, finalB] = await Promise.all([
      db.variant.findUniqueOrThrow({ where: { id: a.id } }),
      db.variant.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(finalA.stockActual).toBe(5); // intacto: rollback total
    expect(finalB.stockActual).toBe(1);
  });

  it("el ajuste manual fija el stock por el libro contable", async () => {
    const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
    const variant = await createTestVariant(SKU, 10);

    const result = await setStockTo({
      variantId: variant.id,
      target: 4,
      reason: "MERMA",
      actorId: admin.id,
      note: "test de ajuste",
    });
    expect(result).toEqual({ from: 10, to: 4 });

    const movements = await db.stockMovement.findMany({
      where: { variantId: variant.id },
      orderBy: { createdAt: "asc" },
    });
    expect(movements.at(-1)?.delta).toBe(-6);
    expect(movements.reduce((s, m) => s + m.delta, 0)).toBe(4);
  });

  it("no se puede vender por debajo de cero ni ajustar a negativo", async () => {
    const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
    const variant = await createTestVariant(SKU, 2);

    await expect(
      sellStock({
        items: [{ variantId: variant.id, qty: 3 }],
        channel: "POS",
        reason: "VENTA_POS",
      }),
    ).rejects.toThrow(StockError);

    await expect(
      setStockTo({
        variantId: variant.id,
        target: -1,
        reason: "AJUSTE_MANUAL",
        actorId: admin.id,
      }),
    ).rejects.toThrow();
  });

  it("después de todo, el libro contable global sigue cuadrando", async () => {
    expect(await findLedgerMismatches()).toEqual([]);
  });
});
