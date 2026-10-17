// Movimientos: ventas, ingresos y egresos (de caja o manuales) y cierres.
// Ver openspec/changes/s09-pos-caja (turno) y el pedido de Daniel del 17 oct 2026.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listMovimientos, registrarMovimientoManual, totalesMovimientos } from "@/modules/sales/movements";

const MARCA = "zzt-movimiento-manual";
let adminId = "";
// Un rango propio en el pasado: no se mezcla con lo que haya hoy en la base.
const DIA = new Date("2020-02-02T15:00:00Z");
const RANGO = { from: new Date("2020-02-02T00:00:00Z"), to: new Date("2020-02-02T23:59:59Z") };

async function limpiar() {
  await db.cashMovement.deleteMany({ where: { reason: { startsWith: MARCA } } });
}

beforeAll(async () => {
  await limpiar();
  adminId = (await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } })).id;
});
afterAll(limpiar);

describe("movimiento manual del administrador", () => {
  it("valida tipo, valor y concepto", async () => {
    expect(await registrarMovimientoManual({ kind: "EGRESO", monto: 0, motivo: `${MARCA} x` }, adminId)).toMatchObject({ ok: false });
    expect(await registrarMovimientoManual({ kind: "INGRESO", monto: 1000, motivo: "a" }, adminId)).toMatchObject({ ok: false });
  });

  it("cuenta en los totales y aparece con su tipo; un cierre o filtro Online no lo trae", async () => {
    expect((await registrarMovimientoManual({ kind: "EGRESO", monto: 500_000, motivo: `${MARCA} arriendo` }, adminId)).ok).toBe(true);
    expect((await registrarMovimientoManual({ kind: "INGRESO", monto: 200_000, motivo: `${MARCA} aporte` }, adminId)).ok).toBe(true);
    await db.cashMovement.updateMany({ where: { reason: { startsWith: MARCA } }, data: { createdAt: DIA } });

    const t = await totalesMovimientos(RANGO);
    expect(t).toMatchObject({ egresos: 500_000, cantidadEgresos: 1, ingresosManuales: 200_000, cantidadIngresos: 1 });

    const todos = await listMovimientos(RANGO);
    const manuales = todos.rows.filter((r) => r.clase === "MOVIMIENTO");
    expect(manuales.map((m) => [m.tipo, m.clase === "MOVIMIENTO" && m.origen])).toEqual(
      expect.arrayContaining([["EGRESO", "MANUAL"], ["INGRESO", "MANUAL"]]),
    );

    const soloEgresos = await listMovimientos({ ...RANGO, tipo: "EGRESO" });
    expect(soloEgresos.rows.every((r) => r.tipo === "EGRESO")).toBe(true);
    expect(soloEgresos.total).toBe(1);

    // Los manuales no son de la caja: filtrar el canal Punto de venta no los trae.
    expect((await totalesMovimientos({ ...RANGO, channel: "POS" })).cantidadEgresos).toBe(0);
    expect((await listMovimientos({ ...RANGO, channel: "WEB" })).rows.filter((r) => r.clase === "MOVIMIENTO")).toHaveLength(0);
  });
});
