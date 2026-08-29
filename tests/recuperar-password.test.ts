// Recuperación de contraseña del comprador, por código al correo.
//
// Lo que se fija aquí es casi todo lo que NO debe pasar. Un flujo de
// recuperación es la puerta de atrás de todo el sistema de cuentas: si falla,
// falla hacia "cualquiera entra", no hacia "nadie entra".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/modules/buyer/password";
import {
  MAX_INTENTOS,
  MENSAJE_CODIGO_INVALIDO,
  MENSAJE_ENVIO,
  VIGENCIA_CODIGO_MS,
  confirmPasswordReset,
  requestPasswordReset,
} from "@/modules/buyer/reset";
import { hashToken } from "@/modules/buyer/session";

const PREFIJO = "zzrec";
const AHORA = new Date("2026-08-28T12:00:00Z");

async function conCuenta(over: Record<string, unknown> = {}) {
  return db.customer.create({
    data: {
      name: `${PREFIJO} Compradora`,
      email: `${PREFIJO}-${Math.random().toString(36).slice(2, 8)}@ejemplo.com`,
      passwordHash: await hashPassword("laVieja123"),
      accountActive: true,
      accountCreated: new Date(),
      ...over,
    },
  });
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length > 0) {
    await db.passwordReset.deleteMany({ where: { customerId: { in: ids } } });
    await db.buyerSession.deleteMany({ where: { customerId: { in: ids } } });
    await db.customer.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeEach(limpiar);
afterEach(limpiar);

describe("pedir el código no revela nada", () => {
  it("🔒 un correo SIN cuenta no genera código, y desde fuera se ve igual", async () => {
    const r = await requestPasswordReset("no-existe-jamas@ejemplo.com", AHORA);
    expect(r.codigo).toBeNull();
    // El mensaje es el mismo pase lo que pase: es lo único que ve quien pregunta.
    expect(MENSAJE_ENVIO).not.toMatch(/no encontramos|no existe|no est[áa] registrad/i);
  });

  it("🔒 quien compró como invitado tampoco tiene nada que recuperar", async () => {
    // Sin contraseña no hay contraseña que cambiar. Esa persona se REGISTRA, y
    // al hacerlo recupera su historial y su cashback: es otro camino.
    const c = await conCuenta({ passwordHash: null, accountActive: false });
    expect((await requestPasswordReset(c.email!, AHORA)).codigo).toBeNull();
  });

  it("con cuenta activa sí genera un código de 6 dígitos", async () => {
    const c = await conCuenta();
    const r = await requestPasswordReset(c.email!, AHORA);
    expect(r.codigo).toMatch(/^\d{6}$/);
  });

  it("🔒 el código NO se guarda en claro", async () => {
    // Quien pueda leer esta tabla no debe poder entrar en ninguna cuenta.
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);

    const filas = await db.passwordReset.findMany({ where: { customerId: c.id } });
    expect(filas).toHaveLength(1);
    expect(filas[0].codeHash).not.toBe(codigo);
    expect(filas[0].codeHash.length).toBeGreaterThan(20);
  });

  it("🔒 pedir uno nuevo MATA el anterior", async () => {
    // Si no, cada solicitud ampliaría la superficie en vez de renovarla.
    const c = await conCuenta();
    const primero = await requestPasswordReset(c.email!, AHORA);
    const segundo = await requestPasswordReset(c.email!, AHORA);

    const viejo = await confirmPasswordReset(c.email!, primero.codigo!, "nuevaClave123", AHORA);
    expect(viejo.ok).toBe(false);

    const nuevo = await confirmPasswordReset(c.email!, segundo.codigo!, "nuevaClave123", AHORA);
    expect(nuevo.ok).toBe(true);
  });
});

describe("usar el código", () => {
  it("con el código correcto cambia la contraseña", async () => {
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);

    expect((await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", AHORA)).ok).toBe(true);

    const despues = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(await verifyPassword("nuevaClave123", despues.passwordHash!)).toBe(true);
    expect(await verifyPassword("laVieja123", despues.passwordHash!)).toBe(false);
  });

  it("🔒 el mismo código NO sirve dos veces", async () => {
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);

    await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", AHORA);
    const segunda = await confirmPasswordReset(c.email!, codigo!, "otraClave456", AHORA);

    expect(segunda.ok).toBe(false);
    // Y la contraseña sigue siendo la primera nueva, no la segunda.
    const despues = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(await verifyPassword("nuevaClave123", despues.passwordHash!)).toBe(true);
  });

  it("🔒 un código caducado no sirve", async () => {
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);
    const tarde = new Date(AHORA.getTime() + VIGENCIA_CODIGO_MS + 1000);

    expect((await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", tarde)).ok).toBe(false);
  });

  it("🔒 tras el máximo de intentos el código muere, aunque luego se acierte", async () => {
    // Seis dígitos son un millón de combinaciones: sin tope, un guion las
    // prueba en minutos y el hash no ayuda, porque no hay que invertirlo.
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);

    for (let i = 0; i < MAX_INTENTOS; i++) {
      await confirmPasswordReset(c.email!, "000000", "nuevaClave123", AHORA);
    }

    const acertando = await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", AHORA);
    expect(acertando.ok).toBe(false);
    if (!acertando.ok) expect(acertando.error).toBe(MENSAJE_CODIGO_INVALIDO);
  });

  it("🔒 el código de OTRA persona no sirve", async () => {
    const mia = await conCuenta();
    const ajena = await conCuenta();
    const { codigo } = await requestPasswordReset(ajena.email!, AHORA);

    expect((await confirmPasswordReset(mia.email!, codigo!, "nuevaClave123", AHORA)).ok).toBe(false);
  });

  it("una contraseña débil se rechaza antes de tocar el código", async () => {
    const c = await conCuenta();
    const { codigo } = await requestPasswordReset(c.email!, AHORA);

    const r = await confirmPasswordReset(c.email!, codigo!, "123", AHORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("password");

    // Y el código NO se gastó: el error era de la contraseña, no suyo.
    expect((await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", AHORA)).ok).toBe(true);
  });

  it("todos los fallos dicen LO MISMO", async () => {
    // Distinguir "caducado" de "incorrecto" de "ya usado" le dice a quien
    // adivina si va por buen camino.
    const c = await conCuenta();
    await requestPasswordReset(c.email!, AHORA);

    const malo = await confirmPasswordReset(c.email!, "000000", "nuevaClave123", AHORA);
    const inexistente = await confirmPasswordReset(
      "otro-que-no-existe@ejemplo.com",
      "000000",
      "nuevaClave123",
      AHORA,
    );

    expect(malo.ok).toBe(false);
    expect(inexistente.ok).toBe(false);
    if (!malo.ok && !inexistente.ok) expect(malo.error).toBe(inexistente.error);
  });
});

describe("recuperar ECHA a quien estuviera dentro", () => {
  it("🔒 cambiar la contraseña cierra todas las sesiones abiertas", async () => {
    // Si alguien tomó la cuenta, recuperarla tiene que echarlo. Sin esto sigue
    // dentro con su cookie y la recuperación no ha servido de nada.
    const c = await conCuenta();
    await db.buyerSession.createMany({
      data: [
        { tokenHash: hashToken(`${PREFIJO}-a`), customerId: c.id, expiresAt: new Date(Date.now() + 86_400_000) },
        { tokenHash: hashToken(`${PREFIJO}-b`), customerId: c.id, expiresAt: new Date(Date.now() + 86_400_000) },
      ],
    });

    const { codigo } = await requestPasswordReset(c.email!, AHORA);
    await confirmPasswordReset(c.email!, codigo!, "nuevaClave123", AHORA);

    expect(await db.buyerSession.count({ where: { customerId: c.id } })).toBe(0);
  });
});
