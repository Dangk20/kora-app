// A qué cliente se ancla un pedido de invitado.
//
// EL FALLO QUE ESTO IMPIDE (lo encontró Daniel probando, 1 sep 2026):
// la búsqueda era `findFirst` con un `OR` de correo y teléfono, y un `OR` no
// tiene precedencia. Reutilizando un teléfono, ganaba esa coincidencia y el
// pedido quedaba anclado a un cliente CON OTRO CORREO — que además se
// reescribía con el del pedido. Al crear después la cuenta con el correo del
// pedido no aparecía ningún pedido: ese correo ya no era de nadie. Es justo
// lo contrario de lo que promete el correo de bienvenida.
//
// Y el error tenía el peor de los dos filos posibles: fusionar por teléfono a
// dos personas distintas —una familia, un negocio, un número reasignado— le
// enseña a alguien las compras y el saldo de cashback de otro.
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveOrderCustomer } from "@/modules/orders/customer-link";

const TEL = "+573007654321";
const DUENIO = "duenio-del-telefono@prueba-anclaje.local";
const NUEVO = "comprador-nuevo@prueba-anclaje.local";
const SOLO_TEL = "sin-correo@prueba-anclaje.local";

const datos = (email: string, phone: string) => ({
  buyerCustomerId: null,
  name: "Comprador de prueba",
  email,
  phone,
  country: "CO",
  city: "Neiva",
  address: "CL 22",
  acceptsMarketing: false,
});

/** Cada caso corre en una transacción que se revierte: no deja registros. */
async function enTransaccion<T>(fn: (tx: Parameters<typeof resolveOrderCustomer>[0]) => Promise<T>): Promise<T> {
  class Revertir extends Error {
    resultado?: T;
  }
  try {
    await db.$transaction(async (tx) => {
      const error = new Revertir();
      error.resultado = await fn(tx);
      throw error;
    });
  } catch (e) {
    if (e instanceof Revertir) return e.resultado as T;
    throw e;
  }
  throw new Error("inalcanzable");
}

afterAll(async () => {
  await db.customer.deleteMany({
    where: { email: { endsWith: "@prueba-anclaje.local" } },
  });
});

describe("un teléfono compartido no fusiona a dos personas", () => {
  it("el pedido NO se ancla al dueño del teléfono si su correo es otro", async () => {
    const r = await enTransaccion(async (tx) => {
      const duenio = await tx.customer.create({
        data: { name: "Dueño del teléfono", email: DUENIO, phone: TEL, source: "WEB" },
      });
      const cliente = await resolveOrderCustomer(tx, datos(NUEVO, TEL));
      const duenioAhora = await tx.customer.findUnique({ where: { id: duenio.id } });
      return { mismo: cliente.id === duenio.id, correo: cliente.email, correoDuenio: duenioAhora?.email };
    });

    expect(r.mismo).toBe(false);
    expect(r.correo).toBe(NUEVO);
  });

  it("y el correo del dueño del teléfono NO se reescribe", async () => {
    // El correo es la CREDENCIAL de acceso a la cuenta. Reescribirlo desde un
    // pedido de invitado dejaba que alguien que supiera tu teléfono cambiara
    // con qué correo entras. Y como `email` es ÚNICO, si ese correo ya era de
    // otro cliente la escritura fallaba y se caía la compra entera.
    const r = await enTransaccion(async (tx) => {
      const duenio = await tx.customer.create({
        data: { name: "Dueño del teléfono", email: DUENIO, phone: TEL, source: "WEB" },
      });
      await resolveOrderCustomer(tx, datos(NUEVO, TEL));
      return (await tx.customer.findUnique({ where: { id: duenio.id } }))?.email;
    });

    expect(r).toBe(DUENIO);
  });

  it("crear el cliente nuevo NO revienta por el teléfono repetido", async () => {
    // `phone` también es ÚNICO. Al dejar de fusionar, el `create` chocaba y
    // tumbaba la transacción del pedido: la corrección habría cambiado un
    // pedido mal anclado por una compra imposible. El teléfono no se pierde:
    // el pedido guarda su propio `contactPhone`.
    const r = await enTransaccion(async (tx) => {
      await tx.customer.create({
        data: { name: "Dueño del teléfono", email: DUENIO, phone: TEL, source: "WEB" },
      });
      const cliente = await resolveOrderCustomer(tx, datos(NUEVO, TEL));
      return cliente.phone;
    });

    expect(r).toBeNull();
  });
});

describe("el correo manda sobre el teléfono", () => {
  it("con correo conocido se usa ese cliente, aunque el teléfono sea de otro", async () => {
    const r = await enTransaccion(async (tx) => {
      const porCorreo = await tx.customer.create({
        data: { name: "Ya compró antes", email: NUEVO, source: "WEB" },
      });
      await tx.customer.create({
        data: { name: "Dueño del teléfono", email: DUENIO, phone: TEL, source: "WEB" },
      });
      const cliente = await resolveOrderCustomer(tx, datos(NUEVO, TEL));
      return cliente.id === porCorreo.id;
    });

    expect(r).toBe(true);
  });

  it("un cliente SIN correo sí se reconoce por teléfono, y se le rellena", async () => {
    // Es el caso que el teléfono sí resuelve bien: alguien registrado por el
    // POS o importado sin correo, que ahora compra en línea.
    const r = await enTransaccion(async (tx) => {
      const sinCorreo = await tx.customer.create({
        data: { name: "Cliente del POS", phone: TEL, source: "POS" },
      });
      const cliente = await resolveOrderCustomer(tx, datos(SOLO_TEL, TEL));
      return { mismo: cliente.id === sinCorreo.id, correo: cliente.email };
    });

    expect(r.mismo).toBe(true);
    expect(r.correo).toBe(SOLO_TEL);
  });
});
