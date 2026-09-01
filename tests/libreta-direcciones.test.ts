// La libreta de direcciones del comprador.
// Ver openspec/changes/libreta-de-direcciones — specs/buyer-addresses.
//
// Lo que se defiende aquí no es que "guardar funcione", sino las tres cosas
// que, si se rompen, no producen ningún error: que solo haya UNA
// predeterminada, que una dirección ajena no se toque, y que editar o borrar
// una dirección NO reescriba un pedido ya despachado.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "@/modules/customers/addresses";

const CORREO = (n: string) => `libreta-${n}@prueba-direcciones.local`;

async function cliente(n: string) {
  return db.customer.create({
    data: { name: `Cliente ${n}`, email: CORREO(n), source: "WEB" },
    select: { id: true },
  });
}

const direccion = (address: string) => ({
  country: "CO",
  state: "Huila",
  city: "Neiva",
  address,
  neighborhood: "Orquídea",
});

afterEach(async () => {
  await db.customer.deleteMany({
    where: { email: { endsWith: "@prueba-direcciones.local" } },
  });
});

describe("exactamente una predeterminada", () => {
  it("la primera dirección queda predeterminada sin pedirlo", async () => {
    const c = await cliente("primera");
    await createAddress(c.id, direccion("CL 1"));

    const lista = await listAddresses(c.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].isDefault).toBe(true);
  });

  it("marcar otra desmarca la anterior", async () => {
    const c = await cliente("marcar");
    await createAddress(c.id, direccion("CL 1"));
    const segunda = await createAddress(c.id, direccion("CL 2"));

    await setDefaultAddress(c.id, segunda);

    const lista = await listAddresses(c.id);
    expect(lista.filter((d) => d.isDefault)).toHaveLength(1);
    expect(lista.find((d) => d.isDefault)?.id).toBe(segunda);
  });

  it("borrar la predeterminada asciende a otra", async () => {
    const c = await cliente("borrar");
    const primera = await createAddress(c.id, direccion("CL 1"));
    await createAddress(c.id, direccion("CL 2"));

    await deleteAddress(c.id, primera);

    const lista = await listAddresses(c.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].isDefault).toBe(true);
  });
});

describe("una dirección es de su dueño", () => {
  it("no se edita la de otro, y la respuesta no delata que existe", async () => {
    const mia = await cliente("mia");
    const suya = await cliente("suya");
    const ajena = await createAddress(suya.id, direccion("CL AJENA"));

    const hecho = await updateAddress(mia.id, ajena, direccion("CL SECUESTRADA"));

    expect(hecho).toBe(false);
    const deSuDuenio = await listAddresses(suya.id);
    expect(deSuDuenio[0].address).toBe("CL AJENA");
  });

  it("no se borra la de otro", async () => {
    const mia = await cliente("mia2");
    const suya = await cliente("suya2");
    const ajena = await createAddress(suya.id, direccion("CL AJENA"));

    expect(await deleteAddress(mia.id, ajena)).toBe(false);
    expect(await listAddresses(suya.id)).toHaveLength(1);
  });
});

describe("el espejo del panel sigue a la predeterminada", () => {
  it("customer.city/address reflejan la dirección que manda", async () => {
    const c = await cliente("espejo");
    await createAddress(c.id, direccion("CL 1"));
    const segunda = await createAddress(c.id, { ...direccion("CL 2"), city: "Bogotá" });

    await setDefaultAddress(c.id, segunda);

    const fila = await db.customer.findUnique({
      where: { id: c.id },
      select: { city: true, address: true },
    });
    expect(fila?.address).toBe("CL 2");
    expect(fila?.city).toBe("Bogotá");
  });

  it("sin direcciones, el espejo queda vacío en vez de conservar una fantasma", async () => {
    const c = await cliente("vacio");
    const unica = await createAddress(c.id, direccion("CL 1"));
    await deleteAddress(c.id, unica);

    const fila = await db.customer.findUnique({
      where: { id: c.id },
      select: { city: true, address: true },
    });
    expect(fila?.address).toBeNull();
    expect(fila?.city).toBeNull();
  });

  it("lo escribe UNA sola función", () => {
    // Con dos escritores, el espejo y la libreta se separan — que es
    // exactamente el fallo que este diseño acepta la duplicación para evitar.
    const modulo = readFileSync("src/modules/customers/addresses.ts", "utf8");
    const escrituras = modulo.match(/tx\.customer\.update\(/g) ?? [];
    expect(escrituras.length).toBe(1);
  });
});

describe("la libreta no toca los pedidos ya hechos", () => {
  it("editar o borrar una dirección no cambia los datos de entrega del pedido", () => {
    // El pedido guarda su propio snapshot (`ship*`) y NO referencia la
    // libreta: una referencia podría apuntar a datos distintos de los que se
    // despacharon. Se comprueba en el esquema, que es donde vive la garantía.
    const esquema = readFileSync("prisma/schema.prisma", "utf8");
    const modeloPedido = esquema.slice(esquema.indexOf("model Order {"));
    expect(modeloPedido).not.toMatch(/addressId/);
    expect(modeloPedido).toMatch(/shipAddress\s+String\?/);
  });
});

describe("«Mis datos» ya no contiene la dirección", () => {
  it("ni ciudad ni dirección son editables ahí", () => {
    const tarjeta = readFileSync("src/app/(tienda)/cuenta/cuenta-forms.tsx", "utf8");
    expect(tarjeta).not.toMatch(/id="city"/);
    expect(tarjeta).not.toMatch(/id="address"/);
  });
});

describe("el checkout con una dirección elegida", () => {
  const vista = readFileSync("src/app/(tienda)/checkout/checkout-view.tsx", "utf8");

  it("no repite los campos: la tarjeta ya enseña la dirección", () => {
    expect(vista).toContain("const camposVisibles = direccionId === null || incompleta(elegida)");
    expect(vista).toContain("{camposVisibles && (");
  });

  it("quita el bloque del DOM en vez de esconderlo con CSS", () => {
    // Oculto por clase seguiría enviándose, y como con la dirección elegida ya
    // viajan los campos ocultos, cada dato iría DOS veces en el formulario:
    // `formData.get()` devuelve el primero, así que el pedido se crearía con
    // el valor equivocado sin que nada fallara.
    expect(vista).not.toMatch(/className=\{camposVisibles \? "grid[^"]*" : "hidden"\}/);
  });

  it("los campos ocultos no llevan `required`", () => {
    // Un `required` sobre un campo que no se puede ver bloquea el envío con un
    // error que el navegador ni siquiera consigue señalar.
    const ocultos = vista.slice(
      vista.indexOf('<input type="hidden" name="state"'),
      vista.indexOf('<input type="hidden" name="notes"'),
    );
    expect(ocultos).not.toContain("required");
  });

  it("una dirección incompleta SÍ muestra los campos", () => {
    // Las direcciones que vienen del backfill son texto libre, sin
    // departamento ni barrio. Ocultarlas mandaría un pedido incompleto que el
    // servidor rechaza señalando un campo que el comprador no puede ver.
    expect(vista).toContain("const incompleta = (d: Address | null) =>");
  });
});
