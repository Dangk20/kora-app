// Invariante central del sistema (plan técnico §2.1):
// la suma del libro contable de movimientos SIEMPRE cuadra con el stock materializado.
// Este mismo chequeo correrá como job nocturno en producción (S4).
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

afterAll(() => db.$disconnect());

describe("libro contable de inventario", () => {
  it("la suma de movimientos cuadra con stockActual en todas las variantes", async () => {
    const mismatches = await db.$queryRaw<
      { sku: string; stock_actual: number; ledger_sum: number }[]
    >`
      SELECT v.sku,
             v."stockActual" AS stock_actual,
             COALESCE(SUM(m.delta), 0)::int AS ledger_sum
      FROM variants v
      LEFT JOIN stock_movements m ON m."variantId" = v.id
      GROUP BY v.id, v.sku, v."stockActual"
      HAVING v."stockActual" <> COALESCE(SUM(m.delta), 0)
    `;
    expect(mismatches).toEqual([]);
  });

  it("no hay stock negativo", async () => {
    const negatives = await db.variant.findMany({
      where: { stockActual: { lt: 0 } },
      select: { sku: true, stockActual: true },
    });
    expect(negatives).toEqual([]);
  });

  it("el seed dejó datos operables (roles, admin, catálogo)", async () => {
    expect(await db.role.count()).toBeGreaterThanOrEqual(4);
    expect(await db.user.count({ where: { role: { name: "admin" } } })).toBeGreaterThanOrEqual(1);
    expect(await db.product.count()).toBeGreaterThan(0);
    expect(await db.variant.count()).toBeGreaterThan(0);
  });
});
