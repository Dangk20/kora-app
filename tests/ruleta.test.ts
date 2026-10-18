// La ruleta de la apertura (change ruleta-apertura): un giro por cuenta y por
// celular, el premio lo decide el servidor y los topes no se pasan aunque
// varios giren a la vez.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStockTo } from "@/modules/inventory/engine";
import { descuentoDeBeneficio } from "@/modules/pos/sale";
import { fijarClaveNueva, generarClaveTemporal, verifyBuyer } from "@/modules/buyer/account";
import { hashPassword } from "@/modules/buyer/password";
import { PREMIOS, RULETA_KEY, guardarConfig, type ConfigRuleta } from "@/modules/ruleta/premios";
import { elegir, estadoRuleta, girar, resumenRuleta } from "@/modules/ruleta/ruleta";

const PREFIJO = "tst-ruleta";
const CELS = Array.from({ length: 8 }, (_, i) => `+57310888000${i}`);
const ROPA = PREMIOS.find((p) => p.key === "ropa-15")!;
const STRAPLESS = PREMIOS.find((p) => p.key === "strapless-gratis")!;

let adminId = "";
let previo: unknown = undefined;
const creadas: string[] = [];
let skuCreado = false;
const clientes: string[] = [];

/** Solo los premios nombrados salen; el resto con peso 0. */
function config(activa: boolean, solo: Record<string, { peso?: number; tope?: number | null }>): ConfigRuleta {
  return {
    activa,
    premios: Object.fromEntries(
      PREMIOS.map((p) => [p.key, { peso: solo[p.key]?.peso ?? (solo[p.key] ? 1 : 0), tope: solo[p.key]?.tope ?? null }]),
    ),
  };
}

async function nuevoCliente(i: number, conCelular = true) {
  const c = await db.customer.create({
    data: { name: `Ruleta ${i}`, email: `${PREFIJO}-${i}@test.kora`, phone: conCelular ? CELS[i] : null, source: "WEB" },
  });
  clientes.push(c.id);
  return c.id;
}

async function limpiarClientes() {
  const where = { OR: [{ email: { startsWith: PREFIJO } }, { phone: { in: CELS } }] };
  const ids = (await db.customer.findMany({ where, select: { id: true } })).map((c) => c.id);
  await db.ruletaGiro.deleteMany({ where: { OR: [{ customerId: { in: ids } }, { phone: { in: CELS } }] } });
  await db.benefit.deleteMany({ where: { customerId: { in: ids } } });
  await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  adminId = (await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } })).id;
  previo = (await db.setting.findUnique({ where: { key: RULETA_KEY } }))?.value;
  await limpiarClientes();

  // Las categorías y el producto de los premios, si esta base no los tiene.
  for (const slug of ROPA.categorias!) {
    if (!(await db.category.findUnique({ where: { slug } }))) {
      creadas.push((await db.category.create({ data: { name: `Test ${slug}`, slug } })).id);
    }
  }
  if (!(await db.variant.findUnique({ where: { sku: STRAPLESS.sku! } }))) {
    skuCreado = true;
    const p = await db.product.create({ data: { name: "Strapless test", slug: `${PREFIJO}-strapless`, active: true, categoryId: creadas[0] ?? (await db.category.findFirstOrThrow()).id } });
    const v = await db.variant.create({
      data: { productId: p.id, sku: STRAPLESS.sku!, name: "Única", priceCopStore: 50_000, priceCopOnline: 1, priceUsdStore: 1, priceUsdOnline: 1 },
    });
    await setStockTo({ variantId: v.id, target: 3, onlineTarget: 0, reason: "AJUSTE_MANUAL", actorId: adminId, note: "test ruleta" });
  }
});

afterAll(async () => {
  await limpiarClientes();
  if (skuCreado) {
    await db.stockMovement.deleteMany({ where: { variant: { sku: STRAPLESS.sku! } } });
    await db.variant.deleteMany({ where: { sku: STRAPLESS.sku! } });
    await db.product.deleteMany({ where: { slug: `${PREFIJO}-strapless` } });
  }
  await db.category.deleteMany({ where: { id: { in: creadas } } });
  if (previo === undefined) await db.setting.deleteMany({ where: { key: RULETA_KEY } });
  else await db.setting.update({ where: { key: RULETA_KEY }, data: { value: previo as object } });
});

describe("elegir", () => {
  it("reparte por peso", () => {
    const ops = [{ k: "a", peso: 3 }, { k: "b", peso: 1 }];
    expect(elegir(ops, 0).k).toBe("a");
    expect(elegir(ops, 0.74).k).toBe("a");
    expect(elegir(ops, 0.76).k).toBe("b");
    expect(elegir(ops, 0.999).k).toBe("b");
  });
});

describe("girar", () => {
  it("cerrada no gira", async () => {
    await guardarConfig(config(false, { "cashback-5000": {} }));
    const id = await nuevoCliente(0);
    expect(await girar(id)).toEqual({ ok: false, motivo: "CERRADA" });
    expect(await db.ruletaGiro.count({ where: { customerId: id } })).toBe(0);
  });

  it("el cashback de regalo queda en el saldo y el giro registrado; no se repite por cuenta ni por celular", async () => {
    await guardarConfig(config(true, { "cashback-5000": {} }));
    const id = (await db.customer.findFirstOrThrow({ where: { phone: CELS[0] } })).id;
    const r = await girar(id);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.premio).toBe("cashback-5000");
    const b = await db.benefit.findUniqueOrThrow({ where: { id: r.benefitId } });
    expect(b.source).toBe("RULETA");
    expect(b.kind).toBe("CASHBACK");
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id } })).cashbackCop)).toBe(5000);
    expect((await estadoRuleta(id)).giro?.premio).toBe("cashback-5000");

    expect(await girar(id)).toEqual({ ok: false, motivo: "YA_GIRO" });

    // Otra cuenta sin celular que escribe el mismo: no vuelve a girar.
    const otra = await nuevoCliente(1, false);
    expect(await girar(otra, CELS[0])).toEqual({ ok: false, motivo: "CELULAR_USADO" });
  });

  it("sin celular no gira; con uno escrito libre, gira y se le guarda a la cuenta", async () => {
    await guardarConfig(config(true, { "cashback-10000": {} }));
    const id = (await db.customer.findFirstOrThrow({ where: { email: `${PREFIJO}-1@test.kora` } })).id;
    expect(await girar(id)).toEqual({ ok: false, motivo: "SIN_CELULAR" });
    const r = await girar(id, "310 888 0001");
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect((await db.customer.findUniqueOrThrow({ where: { id } })).phone).toBe(CELS[1]);
  });

  it("15% en ropa cubre todas las categorías de ropa", async () => {
    await guardarConfig(config(true, { "ropa-15": {} }));
    const id = await nuevoCliente(2);
    const r = await girar(id);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const b = await db.benefit.findUniqueOrThrow({ where: { id: r.benefitId }, include: { category: true } });
    expect(b.kind).toBe("DESCUENTO_CATEGORIA");
    expect(Number(b.amount)).toBe(15);
    expect(1 + b.extraCategoryIds.length).toBe(ROPA.categorias!.length);
    // Un producto de Niño (una de las extra) recibe el 15%.
    const nino = (await db.category.findUniqueOrThrow({ where: { slug: "nino" } })).id;
    const d = descuentoDeBeneficio(b, [{ variantId: "x", categorias: ["sub", nino], unitPrice: 40_000, total: 40_000 }]);
    expect(d).toEqual({ ok: true, discount: 6000 });
  });

  it("el tope de la prenda no se pasa aunque varios giren a la vez", async () => {
    await guardarConfig(config(true, { "strapless-gratis": { peso: 1, tope: 1 } }));
    const ids = await Promise.all([3, 4, 5, 6, 7].map((i) => nuevoCliente(i)));
    const rs = await Promise.all(ids.map((id) => girar(id)));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => !r.ok && r.motivo === "SIN_PREMIOS")).toHaveLength(4);
    const resumen = await resumenRuleta();
    expect(resumen.porPremio["strapless-gratis"].ganados).toBeGreaterThanOrEqual(1);
  });
});

describe("registro rápido: contraseña temporal", () => {
  it("cada clave es distinta, legible y cumple el mínimo", () => {
    const a = generarClaveTemporal();
    const b = generarClaveTemporal();
    expect(a).toMatch(/^KORA-[2-9A-HJKMNP-Z]{6}$/);
    expect(a).not.toBe(b);
  });

  it("el cambio obligado solo vale con la marca puesta, y la quita", async () => {
    const clave = generarClaveTemporal();
    const c = await db.customer.create({
      data: {
        name: "Ruleta clave", email: `${PREFIJO}-clave@test.kora`, source: "WEB",
        passwordHash: await hashPassword(clave), mustChangePassword: true, accountCreated: new Date(),
      },
    });
    expect((await verifyBuyer(c.email!, clave)).ok).toBe(true);
    expect((await fijarClaveNueva(c.id, "corta")).ok).toBe(false);
    expect((await fijarClaveNueva(c.id, "MiClaveNueva2026")).ok).toBe(true);
    expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).mustChangePassword).toBe(false);
    expect((await verifyBuyer(c.email!, clave)).ok).toBe(false);
    expect((await verifyBuyer(c.email!, "MiClaveNueva2026")).ok).toBe(true);
    // Sin la marca ya no se puede cambiar sin la contraseña actual.
    expect((await fijarClaveNueva(c.id, "OtraClave2026")).ok).toBe(false);
  });
});
