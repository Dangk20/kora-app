// «Si ya habías comprado con este mismo correo, tus pedidos anteriores y tu
// cashback aparecen solos: no hay nada que reclamar ni que migrar.»
//
// Eso lo dice el correo de bienvenida, y por tanto es una PROMESA hecha al
// comprador. Estas pruebas existen porque una promesa en un correo no se puede
// corregir después: ya salió de la casa.
//
// La propiedad la sostiene una decisión de diseño concreta —la credencial
// cuelga del CLIENTE, no de una tabla de usuarios paralela— y eso es
// exactamente lo que puede romperse sin que nada falle: bastaría con que un
// día registrarse creara un cliente nuevo en vez de ponerle contraseña al que
// ya existía. Todo seguiría "funcionando", y el comprador vería su historial
// vacío y su saldo en cero.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { registerBuyer, verifyBuyer } from "@/modules/buyer/account";
import { buyerOrders } from "@/modules/buyer/orders";
import { cashbackBalance } from "@/modules/cashback/balance";
import { creditCashback } from "@/modules/cashback/ledger";
import { enMoneda } from "@/modules/cashback/money";

const PREFIJO = "zzinv";

/** Alguien que compró SIN cuenta: cliente creado en silencio por el checkout. */
async function compraDeInvitado(over: Record<string, unknown> = {}) {
  const email = `${PREFIJO}-${Math.random().toString(36).slice(2, 8)}@ejemplo.com`;

  const cliente = await db.customer.create({
    data: {
      name: `${PREFIJO} Invitada`,
      email,
      phone: `+5731${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
      // Lo que define a un invitado: NO tiene contraseña.
      passwordHash: null,
      accountActive: false,
      ...over,
    },
  });

  const pedido = await db.order.create({
    data: {
      channel: "WEB",
      status: "CONFIRMED",
      customerId: cliente.id,
      contactName: cliente.name,
      contactEmail: email,
      contactPhone: cliente.phone,
      currency: "COP",
      subtotal: 200_000,
      total: 200_000,
      checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
      note: PREFIJO,
    },
  });

  // Y su cashback, acreditado por el LIBRO y no a mano: el saldo es una
  // columna materializada que solo `ledger.ts` puede tocar, así que insertar el
  // movimiento por fuera daría un saldo de cero y la prueba estaría midiendo mi
  // fixture en vez del sistema.
  await db.$transaction((tx) =>
    creditCashback(tx, {
      customerId: cliente.id,
      amount: 6_000,
      currency: "COP",
      orderId: pedido.id,
    }),
  );

  return { cliente, pedido, email };
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length > 0) {
    await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
    await db.orderEmail.deleteMany({ where: { order: { customerId: { in: ids } } } });
    await db.orderStatusHistory.deleteMany({ where: { order: { customerId: { in: ids } } } });
    await db.order.deleteMany({ where: { customerId: { in: ids } } });
    await db.buyerSession.deleteMany({ where: { customerId: { in: ids } } });
    await db.passwordReset.deleteMany({ where: { customerId: { in: ids } } });
    await db.customer.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeEach(limpiar);
afterEach(limpiar);

describe("lo que el correo de bienvenida PROMETE", () => {
  it("🎯 al registrarse con el correo de una compra de invitado, el PEDIDO aparece solo", async () => {
    const { pedido, email } = await compraDeInvitado();

    const r = await registerBuyer({ name: "Invitada Registrada", email, password: "claveNueva123" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.customerId).not.toBeNull();

    const pedidos = await buyerOrders(r.customerId!);
    expect(pedidos.map((p) => p.number)).toContain(pedido.number);
  });

  it("🎯 y su CASHBACK también, con el mismo saldo", async () => {
    const { email } = await compraDeInvitado();

    const r = await registerBuyer({ name: "Invitada Registrada", email, password: "claveNueva123" });
    if (!r.ok || !r.customerId) throw new Error("el registro debía crear la cuenta");

    expect(enMoneda(await cashbackBalance(r.customerId), "COP")).toBe(6_000);
  });

  it("🔒 NO se crea un cliente nuevo: es el MISMO de la compra", async () => {
    // Es la propiedad de la que depende todo lo anterior. Si el registro
    // creara un cliente aparte, nada fallaría: el comprador simplemente vería
    // su historial vacío y su saldo en cero, y el correo le habría mentido.
    const { cliente, email } = await compraDeInvitado();

    const r = await registerBuyer({ name: "Invitada Registrada", email, password: "claveNueva123" });
    if (!r.ok) throw new Error("el registro debía funcionar");

    expect(r.customerId).toBe(cliente.id);
    expect(await db.customer.count({ where: { email } })).toBe(1);
  });

  it("y puede entrar de verdad con esa contraseña", async () => {
    const { email } = await compraDeInvitado();
    await registerBuyer({ name: "Invitada Registrada", email, password: "claveNueva123" });

    const login = await verifyBuyer(email, "claveNueva123");
    expect(login.ok).toBe(true);
  });

  it("🔒 registrarse NO le quita el pedido a nadie ni toca su cashback", async () => {
    // La cuenta se activa; el historial no se reescribe.
    const { cliente, pedido, email } = await compraDeInvitado();
    await registerBuyer({ name: "Otro Nombre", email, password: "claveNueva123" });

    const despues = await db.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(despues.customerId).toBe(cliente.id);
    expect(Number(despues.total)).toBe(200_000);
    expect(await db.cashbackMovement.count({ where: { customerId: cliente.id } })).toBe(1);
  });

  it("🎯 quien YA tiene cuenta: el pedido queda anclado SIN necesidad de entrar", async () => {
    // Es la promesa que sostiene el "no, en otro momento" del checkout. La
    // compra se ata al cliente por el correo, dentro de la transacción de la
    // venta: entrar sirve para VERLA ahora, no para que le pertenezca.
    //
    // Si esto se rompiera, alguien que compra sin iniciar sesión perdería el
    // pedido de vista y el cashback de su saldo — y nada fallaría.
    const { cliente, email } = await compraDeInvitado();
    await registerBuyer({ name: "Con Cuenta", email, password: "claveNueva123" });

    // Segunda compra, otra vez SIN sesión: el checkout la ata por correo.
    const segundo = await db.order.create({
      data: {
        channel: "WEB",
        status: "PENDING",
        customerId: cliente.id,
        contactName: cliente.name,
        contactEmail: email,
        contactPhone: cliente.phone,
        currency: "COP",
        subtotal: 50_000,
        total: 50_000,
        checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
        note: PREFIJO,
      },
    });

    const pedidos = await buyerOrders(cliente.id);
    expect(pedidos.map((p) => p.number)).toContain(segundo.number);
  });
});

// ─────────────────────────────────────────────────────────────
// La cifra de cashback que la invitación PROMETE.
//
// Esta pantalla estuvo un rato enseñando la lista de beneficios con
// `cashback={null}` fijo: la línea del cashback simplemente no salía, y no
// fallaba nada — ni una prueba, ni un tipo, ni un error en consola. Es el mismo
// patrón que ya costó caro en la pantalla de pedidos del comprador ("Generó $X"
// sin movimiento en el libro): una promesa de dinero que nadie verifica.
//
// Lo que se fija aquí no es el texto, sino de DÓNDE sale el número.
describe("el cashback que promete la invitación de cuenta", () => {
  const vista = readFileSync("src/app/(tienda)/checkout/checkout-view.tsx", "utf8");
  const accion = readFileSync("src/modules/orders/checkout-actions.ts", "utf8");

  it("sale del SERVIDOR, no de una segunda cuenta hecha en el navegador", () => {
    // Dos definiciones de la misma cifra acaban divergiendo, y la que se vería
    // en pantalla no sería la que el libro acredita.
    expect(vista).toContain("cashback={done.cashbackPrevisto}");
    expect(vista).not.toContain("computeAccrual");
    expect(accion).toContain("computeAccrual(");
  });

  it("se calcula sobre el TOTAL GUARDADO, que ya viene neto de cupón y saldo", () => {
    // Restarle otra vez el cashback aplicado descontaría dos veces; calcularlo
    // sobre la suma de líneas lo generaría sobre un número que nadie cobra.
    expect(accion).toMatch(/computeAccrual\(\{\s*total:\s*Number\(order\.total\)/);
  });

  it("una compra que no genera nada NO enseña «$0» en una lista de beneficios", () => {
    // Un cero ahí se lee como un fallo del sistema, no como un cero.
    expect(accion).toMatch(/previsto > 0 \? formatMoney\(previsto, order\.currency\) : null/);
  });
});
