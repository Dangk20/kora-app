// Consumo del plan del proveedor y eventos que reporta por webhook.
// Ver openspec/changes/consumo-y-metricas-de-correo.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createAccountingDriver, createAllowlistDriver } from "@/modules/email";
import type { EmailDriver, EmailMessage } from "@/modules/email/driver";
import { recordProviderEvent } from "@/modules/email/events";
import {
  checkQuota,
  emailLimits,
  emailUsage,
  inicioDelDiaUtc,
  inicioDelMesUtc,
  type EmailUsage,
} from "@/modules/email/usage";
import { firmar, verifyWebhook } from "@/modules/email/webhook";

const env = (o: Record<string, string>) => ({ NODE_ENV: "test", ...o }) as NodeJS.ProcessEnv;
const correo = (to: string): EmailMessage => ({ to, subject: "zzt-consumo", html: "<p>x</p>", text: "x" });

function driverQueAcepta(name: string): EmailDriver {
  let n = 0;
  return { name, async send() { n += 1; return { ok: true, providerId: `${name}-${n}` }; } };
}
function driverQueFalla(): EmailDriver {
  return { name: "roto", async send() { return { ok: false, error: "no", permanent: true }; } };
}

describe("el driver contable", () => {
  it("anota cada envío que el proveedor ACEPTÓ, con su identificador", async () => {
    const anotados: { providerId: string; to: string }[] = [];
    const d = createAccountingDriver(driverQueAcepta("real"), async (r) => { anotados.push(r); });
    await d.send(correo("a@b.co"));
    await d.send(correo("c@b.co"));
    expect(anotados.map((a) => a.providerId)).toEqual(["real-1", "real-2"]);
  });

  it("no anota un envío rechazado", async () => {
    const anotados: unknown[] = [];
    const d = createAccountingDriver(driverQueFalla(), async (r) => { anotados.push(r); });
    await d.send(correo("a@b.co"));
    expect(anotados).toHaveLength(0);
  });

  it("un fallo al anotar no convierte el envío en fallido: el correo ya salió", async () => {
    const d = createAccountingDriver(driverQueAcepta("real"), async () => { throw new Error("base caída"); });
    const r = await d.send(correo("a@b.co"));
    expect(r.ok).toBe(true);
  });

  it("lo que va a disco no se cuenta: la lista permitida va ANTES del contable", async () => {
    // Orden: lista → contable → proveedor. Un correo a alguien fuera de la
    // lista nunca llega al contable, y por tanto no consume cupo.
    const anotados: unknown[] = [];
    const contable = createAccountingDriver(driverQueAcepta("real"), async (r) => { anotados.push(r); });
    const d = createAllowlistDriver(new Set(["si@b.co"]), contable, driverQueAcepta("disco"));
    await d.send(correo("si@b.co"));
    await d.send(correo("no@b.co"));
    expect(anotados).toHaveLength(1);
  });
});

describe("el consumo", () => {
  beforeEach(() => db.providerSend.deleteMany({ where: { subject: "zzt-consumo" } }));
  afterEach(() => db.providerSend.deleteMany({ where: { subject: "zzt-consumo" } }));

  it("los límites vienen del entorno, con los del plan gratuito por defecto", () => {
    expect(emailLimits(env({}))).toEqual({ daily: 100, monthly: 3000 });
    expect(emailLimits(env({ KORA_EMAIL_DAILY_LIMIT: "1000", KORA_EMAIL_MONTHLY_LIMIT: "50000" })))
      .toEqual({ daily: 1000, monthly: 50000 });
    expect(emailLimits(env({ KORA_EMAIL_DAILY_LIMIT: "cero" })).daily).toBe(100);
  });

  it("EL DÍA Y EL MES SE CORTAN EN UTC, no en Bogotá", () => {
    // 2026-09-12 03:00 UTC son las 10 p.m. del 11 en Bogotá. Para el proveedor
    // ya es el 12: contar en Bogotá haría creer que queda cupo que no queda.
    const t = new Date("2026-09-12T03:00:00Z");
    expect(inicioDelDiaUtc(t).toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(inicioDelMesUtc(t).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("cuenta hoy y este mes por separado", async () => {
    const ahora = new Date();
    const ayer = new Date(ahora.getTime() - 26 * 3600_000);
    await db.providerSend.createMany({
      data: [
        { providerId: "zzt-1", to: "a@b.co", subject: "zzt-consumo", sentAt: ahora },
        { providerId: "zzt-2", to: "a@b.co", subject: "zzt-consumo", sentAt: ayer },
      ],
    });
    const u = await emailUsage(ahora, env({ KORA_EMAIL_DAILY_LIMIT: "10", KORA_EMAIL_MONTHLY_LIMIT: "20" }));
    // "ayer" puede caer en el mes anterior si hoy es día 1: solo se afirma lo seguro.
    expect(u.today).toBeGreaterThanOrEqual(1);
    expect(u.month).toBeGreaterThanOrEqual(u.today);
    expect(u.remainingToday).toBe(Math.max(0, 10 - u.today));
  });
});

describe("¿cabe la campaña?", () => {
  const uso = (remainingToday: number, remainingMonth: number): EmailUsage => ({
    today: 0, month: 0, limits: { daily: 100, monthly: 3000 }, remainingToday, remainingMonth,
  });

  it("no cabe en el mes → no arranca", () => {
    expect(checkQuota(450, uso(80, 200))).toEqual({ fits: "no", remainingMonth: 200 });
  });
  it("cabe en el mes, no en el día → avisa cuántos hoy y cuántos después", () => {
    expect(checkQuota(450, uso(80, 2000))).toEqual({ fits: "partial", today: 80, later: 370 });
  });
  it("cabe → sin aviso", () => {
    expect(checkQuota(50, uso(80, 2000))).toEqual({ fits: "yes" });
  });
});

describe("la firma del webhook", () => {
  const secret = "whsec_" + Buffer.from("clave-de-prueba-larga").toString("base64");
  const ahora = 1_800_000_000_000;
  const ts = String(Math.floor(ahora / 1000));
  const body = '{"type":"email.delivered","data":{"email_id":"m1"}}';

  it("acepta una firma correcta y reciente", () => {
    const sig = `v1,${firmar(secret, "msg_1", ts, body)}`;
    expect(verifyWebhook({ secret, id: "msg_1", timestamp: ts, signature: sig, body }, ahora)).toEqual({ ok: true });
  });

  it("acepta cualquiera de varias firmas (rotación de secreto)", () => {
    const sig = `v1,firmavieja= v1,${firmar(secret, "msg_1", ts, body)}`;
    expect(verifyWebhook({ secret, id: "msg_1", timestamp: ts, signature: sig, body }, ahora).ok).toBe(true);
  });

  it("RECHAZA una firma incorrecta: un rebote falso da de baja una dirección", () => {
    const sig = `v1,${firmar("whsec_" + Buffer.from("otra").toString("base64"), "msg_1", ts, body)}`;
    expect(verifyWebhook({ secret, id: "msg_1", timestamp: ts, signature: sig, body }, ahora)).toEqual({ ok: false, reason: "firma" });
  });

  it("rechaza si el cuerpo cambió un solo byte", () => {
    const sig = `v1,${firmar(secret, "msg_1", ts, body)}`;
    expect(verifyWebhook({ secret, id: "msg_1", timestamp: ts, signature: sig, body: body + " " }, ahora).ok).toBe(false);
  });

  it("rechaza una petición de hace más de cinco minutos", () => {
    const viejo = String(Math.floor(ahora / 1000) - 6 * 60);
    const sig = `v1,${firmar(secret, "msg_1", viejo, body)}`;
    expect(verifyWebhook({ secret, id: "msg_1", timestamp: viejo, signature: sig, body }, ahora)).toEqual({ ok: false, reason: "timestamp" });
  });

  it("sin secreto no verifica nada", () => {
    expect(verifyWebhook({ secret: null, id: "x", timestamp: ts, signature: "v1,x", body }, ahora)).toEqual({ ok: false, reason: "sin-secreto" });
  });

  it("sin cabeceras, rechaza", () => {
    expect(verifyWebhook({ secret, id: null, timestamp: ts, signature: null, body }, ahora)).toEqual({ ok: false, reason: "cabeceras" });
  });
});

describe("los eventos del proveedor", () => {
  const PREFIJO = "zzt-evento";
  async function limpiar() {
    await db.emailEvent.deleteMany({ where: { svixId: { startsWith: PREFIJO } } });
    const c = await db.customer.findMany({ where: { email: { endsWith: "@prueba-eventos.local" } }, select: { id: true } });
    const ids = c.map((x) => x.id);
    if (ids.length) {
      await db.consentEvent.deleteMany({ where: { customerId: { in: ids } } });
      await db.customer.deleteMany({ where: { id: { in: ids } } });
    }
  }
  beforeEach(limpiar);
  afterEach(limpiar);

  it("un evento repetido se guarda UNA vez y las dos veces responde bien", async () => {
    const ev = { type: "email.opened", data: { email_id: "m-zzt", to: ["x@prueba-eventos.local"] } };
    const a = await recordProviderEvent(`${PREFIJO}-1`, ev);
    const b = await recordProviderEvent(`${PREFIJO}-1`, ev);
    expect(a).toMatchObject({ stored: true, duplicate: false });
    expect(b).toMatchObject({ stored: false, duplicate: true });
    expect(await db.emailEvent.count({ where: { svixId: `${PREFIJO}-1` } })).toBe(1);
  });

  it("dos aperturas del mismo mensaje son dos eventos distintos", async () => {
    const ev = { type: "email.opened", data: { email_id: "m-zzt", to: ["x@prueba-eventos.local"] } };
    await recordProviderEvent(`${PREFIJO}-a`, ev);
    await recordProviderEvent(`${PREFIJO}-b`, ev);
    expect(await db.emailEvent.count({ where: { providerId: "m-zzt" } })).toBe(2);
  });

  it("un rebote PERMANENTE marca la dirección como no utilizable", async () => {
    const c = await db.customer.create({ data: { name: "zzt", email: "rebota@prueba-eventos.local", emailUsable: true } });
    const r = await recordProviderEvent(`${PREFIJO}-r`, {
      type: "email.bounced",
      data: { email_id: "m-r", to: ["rebota@prueba-eventos.local"], bounce: { type: "Permanent" } },
    });
    expect(r.effect).toContain("no utilizable");
    expect((await db.customer.findUnique({ where: { id: c.id } }))!.emailUsable).toBe(false);
  });

  it("un rebote TRANSITORIO (buzón lleno) no suprime nada", async () => {
    const c = await db.customer.create({ data: { name: "zzt", email: "lleno@prueba-eventos.local", emailUsable: true } });
    await recordProviderEvent(`${PREFIJO}-t`, {
      type: "email.bounced",
      data: { email_id: "m-t", to: ["lleno@prueba-eventos.local"], bounce: { type: "Transient" } },
    });
    expect((await db.customer.findUnique({ where: { id: c.id } }))!.emailUsable).toBe(true);
  });

  it("una queja de spam da de baja", async () => {
    const c = await db.customer.create({ data: { name: "zzt", email: "queja@prueba-eventos.local", acceptsMarketing: true } });
    const r = await recordProviderEvent(`${PREFIJO}-q`, {
      type: "email.complained",
      data: { email_id: "m-q", to: ["queja@prueba-eventos.local"] },
    });
    expect(r.effect).toContain("baja");
    expect((await db.customer.findUnique({ where: { id: c.id } }))!.acceptsMarketing).toBe(false);
  });

  it("un evento de un mensaje desconocido se guarda igual", async () => {
    const r = await recordProviderEvent(`${PREFIJO}-d`, { type: "email.delivered", data: { email_id: "nadie-lo-conoce" } });
    expect(r.stored).toBe(true);
  });
});
