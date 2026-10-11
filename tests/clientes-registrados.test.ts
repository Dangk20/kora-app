// Etiqueta Cliente / No cliente del módulo de clientes.
// Ver openspec/changes/clientes-registrados — specs/customer-directory.
//
// Lo que se fija aquí:
//   1. Quien se registra sin comprar está en el módulo, como No cliente y con cuenta.
//   2. Un pedido pendiente o cancelado NO hace Cliente a nadie.
//   3. Al confirmarse el primer pedido la persona es Cliente en la siguiente
//      consulta, sin escribir nada más: la etiqueta se deriva, no se guarda.
//   4. Invitados y ventas del POS también cuentan.
//   5. Clientes + No clientes = total, y "Registrados en la web" ya no es 0 fijo.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrderStatus, SaleChannel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { registerBuyer } from "@/modules/buyer/account";
import { CONFIRMED_STATUSES } from "@/modules/customers/confirmed";
import { etiquetaDe, parseFiltroEtiqueta } from "@/modules/customers/etiqueta";
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

async function pedido(
  customerId: string,
  status: OrderStatus = "CONFIRMED",
  channel: SaleChannel = "WEB",
) {
  return db.order.create({
    data: { customerId, channel, status, currency: "COP", subtotal: 100, total: 100 },
  });
}

/** La fila de una persona, buscándola como lo haría el operador. */
async function fila(nombre: string, etiqueta?: "clientes" | "no_clientes"): Promise<CustomerRow | undefined> {
  const r = await listCustomers({ search: nombre, etiqueta }, db);
  return r.rows.find((x) => x.name === nombre);
}

beforeEach(limpiar);
afterEach(limpiar);

describe("definición de la etiqueta", () => {
  it("Cliente con al menos un pedido confirmado; No cliente con ninguno", () => {
    expect(etiquetaDe(0)).toBe("no_cliente");
    expect(etiquetaDe(1)).toBe("cliente");
    expect(etiquetaDe(7)).toBe("cliente");
  });

  it("un filtro desconocido en la dirección es Todos, sin error", () => {
    expect(parseFiltroEtiqueta(undefined)).toBe("todos");
    expect(parseFiltroEtiqueta("vip")).toBe("todos");
    expect(parseFiltroEtiqueta("clientes")).toBe("clientes");
    expect(parseFiltroEtiqueta("no_clientes")).toBe("no_clientes");
  });
});

describe("etiqueta en el listado", () => {
  it("registrado sin compra → está en el módulo, No cliente y con cuenta", async () => {
    const c = await registrado();
    const f = await fila(c.name);
    expect(f).toBeDefined();
    expect(f!.etiqueta).toBe("no_cliente");
    expect(f!.tieneCuenta).toBe(true);
  });

  it("con pedido pendiente → sigue siendo No cliente", async () => {
    const c = await registrado();
    await pedido(c.id, "PENDING");
    expect((await fila(c.name))!.etiqueta).toBe("no_cliente");
  });

  it("con pedido cancelado → No cliente", async () => {
    const c = await registrado();
    await pedido(c.id, "CANCELLED");
    expect((await fila(c.name))!.etiqueta).toBe("no_cliente");
  });

  it("al confirmarse su pedido → Cliente en la siguiente consulta, sin escribir nada más", async () => {
    const c = await registrado();
    const p = await pedido(c.id, "PENDING");
    expect((await fila(c.name))!.etiqueta).toBe("no_cliente");

    await db.order.update({ where: { id: p.id }, data: { status: "CONFIRMED" } });

    expect((await fila(c.name))!.etiqueta).toBe("cliente");
  });

  it("todo estado a partir de confirmado cuenta (un entregado sigue siendo venta)", async () => {
    for (const status of CONFIRMED_STATUSES) {
      const c = await invitado();
      await pedido(c.id, status);
      expect((await fila(c.name))!.etiqueta).toBe("cliente");
    }
  });

  it("invitado que compró → Cliente, y figura como invitado", async () => {
    const c = await invitado();
    await pedido(c.id, "CONFIRMED");
    const f = await fila(c.name);
    expect(f!.etiqueta).toBe("cliente");
    expect(f!.tieneCuenta).toBe(false);
  });

  it("venta del POS → Cliente", async () => {
    const c = await invitado();
    await pedido(c.id, "CONFIRMED", "POS");
    expect((await fila(c.name))!.etiqueta).toBe("cliente");
  });

  it("el hash de la contraseña no sale del listado", async () => {
    const c = await registrado();
    const f = await fila(c.name);
    expect(f).not.toHaveProperty("passwordHash");
  });
});

describe("filtro por etiqueta", () => {
  it("Clientes y No clientes separan a las personas, combinados con la búsqueda", async () => {
    const compro = await invitado();
    await pedido(compro.id, "CONFIRMED");
    const noCompro = await registrado();
    await pedido(noCompro.id, "PENDING");

    expect(await fila(compro.name, "clientes")).toBeDefined();
    expect(await fila(compro.name, "no_clientes")).toBeUndefined();
    expect(await fila(noCompro.name, "no_clientes")).toBeDefined();
    expect(await fila(noCompro.name, "clientes")).toBeUndefined();

    // Con la marca como búsqueda: cada filtro trae solo los suyos.
    const soloClientes = await listCustomers({ search: MARCA, etiqueta: "clientes" }, db);
    expect(soloClientes.rows.map((r) => r.id)).toEqual([compro.id]);
    expect(soloClientes.total).toBe(1);
    const soloNo = await listCustomers({ search: MARCA, etiqueta: "no_clientes" }, db);
    expect(soloNo.rows.map((r) => r.id)).toEqual([noCompro.id]);
    const todos = await listCustomers({ search: MARCA }, db);
    expect(todos.total).toBe(2);
  });
});

describe("indicadores", () => {
  it("registrarse suma en total, No clientes y Registrados en la web; no en Clientes", async () => {
    const antes = await customerSummary(db);
    await registrado();
    const despues = await customerSummary(db);

    expect(despues.total).toBe(antes.total + 1);
    expect(despues.noClientes).toBe(antes.noClientes + 1);
    expect(despues.conCuenta).toBe(antes.conCuenta + 1);
    expect(despues.clientes).toBe(antes.clientes);
  });

  it("confirmar el primer pedido pasa a la persona de No clientes a Clientes", async () => {
    const c = await registrado();
    const p = await pedido(c.id, "PENDING");
    const antes = await customerSummary(db);

    await db.order.update({ where: { id: p.id }, data: { status: "CONFIRMED" } });
    const despues = await customerSummary(db);

    expect(despues.clientes).toBe(antes.clientes + 1);
    expect(despues.noClientes).toBe(antes.noClientes - 1);
    expect(despues.total).toBe(antes.total);
  });

  it("varios pedidos confirmados cuentan a la persona UNA vez", async () => {
    const antes = await customerSummary(db);
    const c = await invitado();
    await pedido(c.id);
    await pedido(c.id);
    await pedido(c.id, "CONFIRMED", "POS");
    const despues = await customerSummary(db);
    expect(despues.clientes).toBe(antes.clientes + 1);
    expect(despues.conCuenta).toBe(antes.conCuenta);
  });

  it("Clientes + No clientes = Total de registros, y Registrados en la web es el conteo real", async () => {
    await registrado();
    const c = await invitado();
    await pedido(c.id);

    const r = await customerSummary(db);
    expect(r.clientes + r.noClientes).toBe(r.total);
    expect(r.conCuenta).toBe(await db.customer.count({ where: { passwordHash: { not: null } } }));
    expect(r.conCuenta).toBeGreaterThan(0);
  });
});
