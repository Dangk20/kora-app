// Clasificación del Módulo de clientes: CON cuenta / SIN cuenta (Daniel,
// 17 oct 2026; reemplaza a Cliente / No cliente del change clientes-registrados).
//
// Lo que se fija aquí:
//   1. Quien se registra está en el módulo, con cuenta, aunque no haya comprado.
//   2. El invitado de la web y el cliente de caja están, sin cuenta.
//   3. Comprar NO cambia la clasificación: se deriva de la contraseña, no se guarda.
//   4. Con cuenta + Sin cuenta = Total de registros.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { registerBuyer } from "@/modules/buyer/account";
import { parseFiltroCuenta, type FiltroCuenta } from "@/modules/customers/cuenta";
import { customerSummary, listCustomers, type CustomerRow } from "@/modules/customers/queries";

const MARCA = "ZZTEST-ETQ";

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.orderStatusHistory.deleteMany({ where: { order: { customerId: { in: ids } } } });
  await db.order.deleteMany({ where: { customerId: { in: ids } } });
  await db.buyerSession.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

function sufijo() {
  return Math.random().toString(36).slice(2, 10);
}

/** Invitado: fila de cliente sin contraseña, como la deja el checkout. */
async function invitado() {
  return db.customer.create({
    data: {
      name: `${MARCA} invitado ${sufijo()}`,
      email: `${MARCA.toLowerCase()}-${sufijo()}@test.local`,
      country: "CO",
    },
  });
}

/** Registro real por la tienda: el mismo camino que usa el formulario. */
async function registrado() {
  const email = `${MARCA.toLowerCase()}-${sufijo()}@test.local`;
  const r = await registerBuyer({
    name: `${MARCA} registrado ${sufijo()}`,
    email,
    password: "kora-prueba-2026",
  });
  expect(r.ok).toBe(true);
  return db.customer.findUniqueOrThrow({ where: { email } });
}


/** La fila de una persona, buscándola como lo haría el operador. */
async function fila(nombre: string, cuenta?: FiltroCuenta): Promise<CustomerRow | undefined> {
  const r = await listCustomers({ search: nombre, cuenta }, db);
  return r.rows.find((x) => x.name === nombre);
}

beforeEach(limpiar);
afterEach(limpiar);

describe("filtro por cuenta", () => {
  it("un filtro desconocido en la dirección es Todos, sin error", () => {
    expect(parseFiltroCuenta(undefined)).toBe("todos");
    expect(parseFiltroCuenta("clientes")).toBe("todos"); // el filtro anterior ya no existe
    expect(parseFiltroCuenta("con_cuenta")).toBe("con_cuenta");
    expect(parseFiltroCuenta("sin_cuenta")).toBe("sin_cuenta");
  });
});

describe("clasificación en el listado", () => {
  it("registrado sin compra → está en el módulo, con cuenta", async () => {
    const c = await registrado();
    const f = await fila(c.name);
    expect(f).toBeDefined();
    expect(f!.tieneCuenta).toBe(true);
    expect(f!.source).toBe("WEB");
  });

  it("invitado y cliente de caja → sin cuenta", async () => {
    const inv = await invitado();
    const caja = await db.customer.create({ data: { name: `${MARCA} caja ${sufijo()}`, source: "POS", country: "CO" } });
    expect((await fila(inv.name))!.tieneCuenta).toBe(false);
    const f = await fila(caja.name);
    expect(f!.tieneCuenta).toBe(false);
    expect(f!.source).toBe("POS");
  });

  it("comprar no cambia la clasificación", async () => {
    const c = await invitado();
    await db.order.create({ data: { customerId: c.id, channel: "POS", status: "DELIVERED", currency: "COP", subtotal: 100, total: 100 } });
    expect((await fila(c.name))!.tieneCuenta).toBe(false);
  });

  it("cada filtro trae solo los suyos", async () => {
    const con = await registrado();
    const sin = await invitado();
    expect(await fila(con.name, "con_cuenta")).toBeDefined();
    expect(await fila(con.name, "sin_cuenta")).toBeUndefined();
    expect(await fila(sin.name, "sin_cuenta")).toBeDefined();
    expect(await fila(sin.name, "con_cuenta")).toBeUndefined();
    const todos = await listCustomers({ search: MARCA }, db);
    expect(todos.total).toBe(2);
  });
});

describe("indicadores", () => {
  it("registrarse suma en total y con cuenta", async () => {
    const antes = await customerSummary(db);
    await registrado();
    const despues = await customerSummary(db);
    expect(despues.total).toBe(antes.total + 1);
    expect(despues.conCuenta).toBe(antes.conCuenta + 1);
    expect(despues.sinCuenta).toBe(antes.sinCuenta);
  });

  it("un invitado suma en total y sin cuenta", async () => {
    const antes = await customerSummary(db);
    await invitado();
    const despues = await customerSummary(db);
    expect(despues.sinCuenta).toBe(antes.sinCuenta + 1);
    expect(despues.conCuenta).toBe(antes.conCuenta);
  });

  it("con cuenta + sin cuenta = total de registros, y con cuenta es el conteo real", async () => {
    await registrado();
    await invitado();
    const r = await customerSummary(db);
    expect(r.conCuenta + r.sinCuenta).toBe(r.total);
    expect(r.conCuenta).toBe(await db.customer.count({ where: { passwordHash: { not: null } } }));
  });
});
