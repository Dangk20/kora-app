// Cuenta del comprador. Detrás de esta cuenta hay dinero (saldo de cashback) y
// datos personales de terceros, así que lo que se fija aquí es:
//   1. La sesión del comprador NO sirve para el panel. Es el peor fallo posible.
//   2. Cerrar sesión sirve de algo — se verifica contra la base, no un token.
//   3. La cuenta no filtra pedidos ajenos.
//   4. Nada revela si un correo tiene cuenta.
//   5. Quien compró como invitado recupera su historial al registrarse.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { MENSAJE_ACCESO, changePassword, registerBuyer, verifyBuyer } from "@/modules/buyer/account";
import { buyerOrder, buyerOrders } from "@/modules/buyer/orders";
import { hashPassword, passwordProblem } from "@/modules/buyer/password";
import {
  _reiniciarLimite,
  comprobarLimite,
  limpiarIntentos,
  registrarFallo,
} from "@/modules/buyer/rate-limit";
import { BUYER_COOKIE } from "@/modules/buyer/session-cookie";
import {
  hashToken,
  issueSession,
  pruneExpiredSessions,
  resolveSession,
  revokeAllSessions,
  revokeSession,
} from "@/modules/buyer/session";
import { creditCashback } from "@/modules/cashback/ledger";
import { resolveOrderCustomer } from "@/modules/orders/customer-link";

const PREFIJO = "zzt-buyer";
const CLAVE = "kora-prueba-2026";

let n = 0;
function correo() {
  n += 1;
  return `${PREFIJO}-${n}-${Date.now()}@test.local`;
}

async function comprador(over: { email?: string; password?: string | null } = {}) {
  const email = over.email ?? correo();
  return db.customer.create({
    data: {
      name: `${PREFIJO} ${n}`,
      email,
      passwordHash: over.password === null ? null : await hashPassword(over.password ?? CLAVE),
      accountCreated: over.password === null ? null : new Date(),
    },
  });
}

async function pedido(customerId: string, over: { total?: number; status?: "PENDING" | "CONFIRMED" } = {}) {
  const total = over.total ?? 100_000;
  return db.order.create({
    data: {
      channel: "WEB",
      status: over.status ?? "CONFIRMED",
      currency: "COP",
      customerId,
      subtotal: total,
      total,
      note: PREFIJO,
      expiresAt: new Date(Date.now() + 2 * 3600_000),
    },
  });
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({
      where: { OR: [{ name: { startsWith: PREFIJO } }, { email: { startsWith: PREFIJO } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.buyerSession.deleteMany({ where: { customerId: { in: ids } } });
  await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
  await db.orderStatusHistory.deleteMany({ where: { order: { customerId: { in: ids } } } });
  await db.order.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(async () => {
  _reiniciarLimite();
  await limpiar();
});
afterEach(limpiar);

// ─────────────────────────────────────────────────────────────
describe("LA SESIÓN DEL COMPRADOR NO ES LA DEL PANEL", () => {
  it("el middleware del panel no conoce la cookie del comprador", () => {
    // `authorized` es lo único que decide quién entra a /admin y /pos. Recibe
    // la sesión de Auth.js, que se lee de SU cookie. La del comprador vive en
    // otra y no llega hasta aquí: para el panel, un comprador es alguien sin
    // sesión. Esto es lo que hace que una ruta nueva bajo /admin esté
    // protegida por omisión.
    const pedir = (pathname: string, auth: unknown) =>
      authConfig.callbacks.authorized({
        auth: auth as never,
        request: { nextUrl: { pathname } } as never,
      });

    expect(pedir("/admin/pedidos", null)).toBe(false);
    expect(pedir("/pos", null)).toBe(false);
    // Ni siquiera un objeto que se parezca a una sesión de comprador sirve:
    // no tiene `user`, que es lo único que el panel acepta.
    expect(pedir("/admin", { customerId: "x", name: "comprador" })).toBe(false);
    // Y la tienda sigue abierta para todos.
    expect(pedir("/catalogo", null)).toBe(true);
    expect(pedir("/cuenta", null)).toBe(true);
  });

  it("la cookie del comprador tiene un nombre propio, distinto del de Auth.js", () => {
    expect(BUYER_COOKIE).toBe("kora_buyer");
    expect(BUYER_COOKIE.startsWith("authjs")).toBe(false);
    expect(BUYER_COOKIE.includes("next-auth")).toBe(false);
  });

  it("el identificador de un comprador no es el de ningún operador", async () => {
    // Las cuentas viven en tablas distintas: un comprador nunca aparece en
    // `users`, así que no hay identificador que confundir.
    const c = await comprador();
    expect(await db.user.findUnique({ where: { id: c.id } })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe("sesión", () => {
  it("una sesión emitida autentica", async () => {
    const c = await comprador();
    const { token } = await issueSession(c.id);
    const quien = await resolveSession(token);
    expect(quien?.customerId).toBe(c.id);
  });

  it("EN LA BASE NO QUEDA EL IDENTIFICADOR DE LA COOKIE, solo su hash", async () => {
    const c = await comprador();
    const { token } = await issueSession(c.id);

    expect(await db.buyerSession.findFirst({ where: { tokenHash: token } })).toBeNull();
    const guardada = await db.buyerSession.findFirst({ where: { customerId: c.id } });
    expect(guardada?.tokenHash).toBe(hashToken(token));
    expect(guardada?.tokenHash).not.toBe(token);
  });

  it("revocar la sesión la invalida en la petición siguiente", async () => {
    const c = await comprador();
    const { token } = await issueSession(c.id);
    expect(await resolveSession(token)).not.toBeNull();

    await revokeSession(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("una sesión caducada no autentica", async () => {
    const c = await comprador();
    const { token } = await issueSession(c.id);
    await db.buyerSession.updateMany({
      where: { customerId: c.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resolveSession(token)).toBeNull();
  });

  it("una credencial fabricada no autentica", async () => {
    expect(await resolveSession("no-existe-este-identificador")).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
  });

  it("una cuenta desactivada deja de autenticar, sin tocar la sesión", async () => {
    const c = await comprador();
    const { token } = await issueSession(c.id);
    await db.customer.update({ where: { id: c.id }, data: { accountActive: false } });
    expect(await resolveSession(token)).toBeNull();
  });

  it("el barrido borra las caducadas y respeta las vivas", async () => {
    const c = await comprador();
    const { token: viva } = await issueSession(c.id);
    const { token: muerta } = await issueSession(c.id);
    await db.buyerSession.updateMany({
      where: { tokenHash: hashToken(muerta) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await pruneExpiredSessions();

    expect(await resolveSession(viva)).not.toBeNull();
    expect(await db.buyerSession.count({ where: { tokenHash: hashToken(muerta) } })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe("registro y acceso", () => {
  it("crea la cuenta y permite entrar", async () => {
    const email = correo();
    const r = await registerBuyer({ name: `${PREFIJO} nuevo`, email, password: CLAVE });
    expect(r.ok).toBe(true);

    const login = await verifyBuyer(email, CLAVE);
    expect(login.ok).toBe(true);
  });

  it("QUIEN COMPRÓ COMO INVITADO recupera su historial y su cashback al registrarse", async () => {
    // Compró sin cuenta: existe como cliente, sin contraseña.
    const invitado = await comprador({ password: null });
    const p = await pedido(invitado.id, { total: 200_000 });
    await db.$transaction((tx) =>
      creditCashback(tx, { customerId: invitado.id, amount: 6_000, currency: "COP", orderId: p.id }),
    );

    const r = await registerBuyer({
      name: `${PREFIJO} mismo`,
      email: invitado.email!,
      password: CLAVE,
    });
    expect(r).toMatchObject({ ok: true, customerId: invitado.id });

    // NO se creó un cliente nuevo: es el mismo, con su historial y su saldo.
    expect(await db.customer.count({ where: { email: invitado.email! } })).toBe(1);
    const saldo = await db.customer.findUnique({ where: { id: invitado.id } });
    expect(Number(saldo?.cashbackCop)).toBe(6_000);
    expect(await buyerOrders(invitado.id)).toHaveLength(1);
  });

  it("registrarse con un correo que YA tiene cuenta no la toca ni lo delata", async () => {
    const c = await comprador();
    const antes = await db.customer.findUnique({ where: { id: c.id } });

    const r = await registerBuyer({ name: "Intruso", email: c.email!, password: "otra-clave-123" });

    // La respuesta es un éxito indistinguible del alta normal…
    expect(r.ok).toBe(true);
    // …pero no se cambió nada: la contraseña original sigue siendo la válida.
    const despues = await db.customer.findUnique({ where: { id: c.id } });
    expect(despues?.passwordHash).toBe(antes?.passwordHash);
    expect(despues?.name).toBe(antes?.name);
    expect((await verifyBuyer(c.email!, CLAVE)).ok).toBe(true);
    expect((await verifyBuyer(c.email!, "otra-clave-123")).ok).toBe(false);
  });

  it("EL MENSAJE DE ACCESO ES EL MISMO exista o no el correo", async () => {
    const c = await comprador();

    const inexistente = await verifyBuyer("no-existe@test.local", CLAVE);
    const claveMala = await verifyBuyer(c.email!, "clave-incorrecta");

    expect(inexistente).toEqual({ ok: false, error: MENSAJE_ACCESO });
    expect(claveMala).toEqual({ ok: false, error: MENSAJE_ACCESO });

    // Y una cuenta desactivada tampoco se distingue.
    await db.customer.update({ where: { id: c.id }, data: { accountActive: false } });
    expect(await verifyBuyer(c.email!, CLAVE)).toEqual({ ok: false, error: MENSAJE_ACCESO });
  });

  it("un cliente sin contraseña no puede entrar con ninguna", async () => {
    const invitado = await comprador({ password: null });
    expect((await verifyBuyer(invitado.email!, CLAVE)).ok).toBe(false);
    expect((await verifyBuyer(invitado.email!, "")).ok).toBe(false);
  });

  it("exige el mínimo de contraseña y lo dice", async () => {
    expect(passwordProblem("corta")).toContain("8");
    const r = await registerBuyer({ name: `${PREFIJO} x`, email: correo(), password: "corta" });
    expect(r).toMatchObject({ ok: false, field: "password" });
  });
});

// ─────────────────────────────────────────────────────────────
describe("cambio de contraseña", () => {
  it("cambia la contraseña y CIERRA LAS DEMÁS SESIONES", async () => {
    const c = await comprador();
    const { token: actual } = await issueSession(c.id);
    const { token: otroDispositivo } = await issueSession(c.id);

    expect((await changePassword(c.id, CLAVE, "clave-nueva-2026")).ok).toBe(true);
    await revokeAllSessions(c.id, actual);

    // La sesión desde la que se cambió sigue; la otra, no.
    expect(await resolveSession(actual)).not.toBeNull();
    expect(await resolveSession(otroDispositivo)).toBeNull();
    expect((await verifyBuyer(c.email!, "clave-nueva-2026")).ok).toBe(true);
    expect((await verifyBuyer(c.email!, CLAVE)).ok).toBe(false);
  });

  it("sin acertar la contraseña actual no se cambia nada", async () => {
    const c = await comprador();
    const r = await changePassword(c.id, "no-es-la-actual", "clave-nueva-2026");
    expect(r.ok).toBe(false);
    expect((await verifyBuyer(c.email!, CLAVE)).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe("la cuenta solo muestra lo del comprador", () => {
  it("UN PEDIDO AJENO RESPONDE COMO SI NO EXISTIERA", async () => {
    const mio = await comprador();
    const ajeno = await comprador();
    const suyo = await pedido(ajeno.id, { total: 500_000 });

    // El pedido existe…
    expect(await db.order.findUnique({ where: { id: suyo.id } })).not.toBeNull();
    // …pero no para quien no es su dueño.
    expect(await buyerOrder(mio.id, suyo.number)).toBeNull();
    expect(await buyerOrder(ajeno.id, suyo.number)).not.toBeNull();
  });

  it("el listado solo trae los pedidos propios", async () => {
    const mio = await comprador();
    const ajeno = await comprador();
    await pedido(mio.id);
    await pedido(ajeno.id);
    await pedido(ajeno.id);

    expect(await buyerOrders(mio.id)).toHaveLength(1);
  });

  it("muestra el cashback realmente acreditado, no un cálculo repetido", async () => {
    const c = await comprador();
    const p = await pedido(c.id, { total: 100_000 });
    // El libro dice 2.400 (se pagó parte con saldo); recalcular daría 3.000.
    await db.$transaction((tx) =>
      creditCashback(tx, { customerId: c.id, amount: 2_400, currency: "COP", orderId: p.id }),
    );

    const filas = await buyerOrders(c.id);
    expect(filas[0].cashback).toBe(2_400);
    expect(filas[0].cashbackPendiente).toBe(false);
  });

  it("un pedido sin confirmar muestra su cashback como pendiente", async () => {
    const c = await comprador();
    await pedido(c.id, { total: 100_000, status: "PENDING" });

    const filas = await buyerOrders(c.id);
    expect(filas[0]).toMatchObject({ cashback: 3_000, cashbackPendiente: true });
  });

  it("un pedido pendiente que expiró deja de ofrecerse para retomar", async () => {
    const c = await comprador();
    const p = await db.order.create({
      data: {
        channel: "WEB",
        status: "PENDING",
        currency: "COP",
        customerId: c.id,
        subtotal: 100_000,
        total: 100_000,
        note: PREFIJO,
        expiresAt: new Date(Date.now() - 3600_000),
      },
    });
    const detalle = await buyerOrder(c.id, p.number);
    expect(detalle?.vigente).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe("el pedido se ata al comprador", () => {
  // Teléfonos irrepetibles: la base de desarrollo tiene clientes reales y el
  // teléfono es único. Un número fijo chocaría con ellos, no con la lógica.
  let t = 0;
  const telefono = () => `+5730${String(Date.now() % 100000000 + ++t).padStart(8, "0")}`;

  const datos = (over: Partial<Parameters<typeof resolveOrderCustomer>[1]> = {}) => ({
    buyerCustomerId: null,
    name: `${PREFIJO} comprador`,
    email: correo(),
    phone: telefono(),
    country: "CO",
    city: "Bogotá",
    address: "Calle 1 # 2 - 3",
    acceptsMarketing: false,
    ...over,
  });

  it("CON SESIÓN, un teléfono distinto NO crea un cliente nuevo", async () => {
    const c = await comprador();
    const otro = telefono();

    const r = await db.$transaction((tx) =>
      resolveOrderCustomer(
        tx,
        datos({ buyerCustomerId: c.id, email: c.email!, phone: otro }),
      ),
    );

    expect(r.id).toBe(c.id);
    expect(r.phone).toBe(otro);
    expect(await db.customer.count({ where: { name: { startsWith: PREFIJO } } })).toBe(1);
  });

  it("CON SESIÓN, el correo de la cuenta no se reescribe desde el checkout", async () => {
    // Es la credencial de acceso: cambiarla aquí cambiaría con qué se entra,
    // sin avisar, y podría chocar con el correo de otro cliente.
    const c = await comprador();

    const r = await db.$transaction((tx) =>
      resolveOrderCustomer(tx, datos({ buyerCustomerId: c.id, email: "otro@test.local" })),
    );

    expect(r.email).toBe(c.email);
  });

  it("SIN SESIÓN, la coincidencia por correo sigue funcionando como hasta ahora", async () => {
    const invitado = await comprador({ password: null });

    const r = await db.$transaction((tx) =>
      resolveOrderCustomer(tx, datos({ email: invitado.email! })),
    );

    expect(r.id).toBe(invitado.id);
    expect(await db.customer.count({ where: { name: { startsWith: PREFIJO } } })).toBe(1);
  });

  it("SIN SESIÓN y sin coincidencia, crea el cliente", async () => {
    const r = await db.$transaction((tx) => resolveOrderCustomer(tx, datos()));
    expect(r.id).toBeTruthy();
    expect(r.source).toBe("WEB");
  });

  it("el opt-in de marketing nunca se revoca solo", async () => {
    const c = await comprador();
    await db.customer.update({ where: { id: c.id }, data: { acceptsMarketing: true } });

    const r = await db.$transaction((tx) =>
      resolveOrderCustomer(
        tx,
        datos({ buyerCustomerId: c.id, email: c.email!, acceptsMarketing: false }),
      ),
    );

    expect(r.acceptsMarketing).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe("límite de intentos", () => {
  it("frena tras varios fallos seguidos y se libera al acertar", () => {
    const origen = "1.2.3.4";
    for (let i = 0; i < 8; i++) {
      expect(comprobarLimite(origen).permitido).toBe(true);
      registrarFallo(origen);
    }
    const bloqueado = comprobarLimite(origen);
    expect(bloqueado.permitido).toBe(false);
    if (!bloqueado.permitido) expect(bloqueado.esperaSegundos).toBeGreaterThan(0);

    limpiarIntentos(origen);
    expect(comprobarLimite(origen).permitido).toBe(true);
  });

  it("la ventana caduca sola", () => {
    const origen = "5.6.7.8";
    const t0 = 1_000_000;
    for (let i = 0; i < 8; i++) registrarFallo(origen, t0);
    expect(comprobarLimite(origen, t0).permitido).toBe(false);
    // 16 minutos después la ventana ya pasó.
    expect(comprobarLimite(origen, t0 + 16 * 60_000).permitido).toBe(true);
  });

  it("un origen no bloquea a otro", () => {
    for (let i = 0; i < 8; i++) registrarFallo("9.9.9.9");
    expect(comprobarLimite("9.9.9.9").permitido).toBe(false);
    expect(comprobarLimite("10.10.10.10").permitido).toBe(true);
  });
});
