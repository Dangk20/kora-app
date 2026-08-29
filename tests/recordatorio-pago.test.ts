// El recordatorio de pago: el octavo correo del pedido.
//
// Lo que se fija aquí es sobre todo CUÁNDO no se manda. Un recordatorio que
// llega a destiempo —a mitad de la ventana, o a un pedido ya vencido, o dos
// veces— no es un correo de más: es un correo que enseña al comprador a
// ignorar los siguientes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as emailModule from "@/modules/email";
import { _resetEmailDriver } from "@/modules/email";
import type { EmailMessage } from "@/modules/email/driver";
import { ORDER_TTL_MS } from "@/modules/orders/status";
import { leadTimeMs, sendPaymentReminders } from "@/modules/notifications/reminder";

const PREFIJO = "ZZREC";
const AHORA = new Date("2026-08-28T12:00:00Z");
const HORA = 60 * 60_000;

function driverFalso() {
  const enviados: EmailMessage[] = [];
  vi.spyOn(emailModule, "emailDriver").mockReturnValue({
    name: "falso",
    async send(m) {
      enviados.push(m);
      return { ok: true, providerId: `p-${enviados.length}` };
    },
  });
  return enviados;
}

/** Un pedido pendiente que vence dentro de `enMs`. */
async function pedidoQueVenceEn(enMs: number, over: Record<string, unknown> = {}) {
  return db.order.create({
    data: {
      channel: "WEB",
      status: "PENDING",
      contactName: `${PREFIJO} Comprador`,
      contactEmail: `${PREFIJO}-${Math.random().toString(36).slice(2, 8)}@ejemplo.com`,
      contactPhone: "+573105551234",
      currency: "COP",
      subtotal: 100_000,
      total: 100_000,
      expiresAt: new Date(AHORA.getTime() + enMs),
      whatsappMessage: "Hola KORA, quiero confirmar mi pedido",
      checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
      note: PREFIJO,
      ...over,
    },
  });
}

async function limpiar() {
  const ids = (await db.order.findMany({ where: { note: PREFIJO }, select: { id: true } })).map(
    (o) => o.id,
  );
  if (ids.length > 0) {
    await db.orderEmail.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeEach(async () => {
  vi.restoreAllMocks();
  _resetEmailDriver();
  await limpiar();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await limpiar();
});

describe("cuándo entra un pedido en la ventana", () => {
  it("avisa al que vence dentro de la próxima hora", async () => {
    driverFalso();
    const p = await pedidoQueVenceEn(30 * 60_000); // media hora

    const r = await sendPaymentReminders(AHORA);
    expect(r.sent).toBe(1);
    expect(r.numbers).toHaveLength(1);
    expect(p.status).toBe("PENDING");
  });

  it("🔒 NO avisa al que acaba de crearse", async () => {
    // Con vigencia de 24 h, un pedido recién hecho vence dentro de 24 h. Avisarle
    // ahora sería avisarle en la hora 0, no en la 23.
    driverFalso();
    await pedidoQueVenceEn(ORDER_TTL_MS);

    expect((await sendPaymentReminders(AHORA)).sent).toBe(0);
  });

  it("🔒 NO avisa al que YA venció", async () => {
    // Pedirle a alguien que confirme un pedido que ya expiró es peor que no
    // escribirle: lo manda a WhatsApp a reclamar algo que no existe.
    driverFalso();
    await pedidoQueVenceEn(-5 * 60_000);

    expect((await sendPaymentReminders(AHORA)).sent).toBe(0);
  });

  it("🔒 NO avisa a los que ya no están pendientes", async () => {
    driverFalso();
    await pedidoQueVenceEn(30 * 60_000, { status: "CONFIRMED" });
    await pedidoQueVenceEn(30 * 60_000, { status: "CANCELLED" });

    expect((await sendPaymentReminders(AHORA)).sent).toBe(0);
  });
});

describe("no se manda dos veces", () => {
  it("🔒 dos pasadas seguidas mandan UN solo correo", async () => {
    // El trabajo corre cada 10 min sobre una ventana de una hora, así que el
    // mismo pedido entra en varias pasadas. Quien lo impide es la reserva, no
    // la ventana.
    const enviados = driverFalso();
    await pedidoQueVenceEn(30 * 60_000);

    const primera = await sendPaymentReminders(AHORA);
    const segunda = await sendPaymentReminders(new Date(AHORA.getTime() + 10 * 60_000));

    expect(primera.sent).toBe(1);
    expect(segunda.sent).toBe(0);
    expect(enviados).toHaveLength(1);
  });

  it("queda una sola fila de reserva para ese pedido", async () => {
    driverFalso();
    const p = await pedidoQueVenceEn(20 * 60_000);

    await sendPaymentReminders(AHORA);
    await sendPaymentReminders(AHORA);

    const filas = await db.orderEmail.findMany({
      where: { orderId: p.id, type: "BUYER_PAYMENT_REMINDER" },
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].sentAt).not.toBeNull();
  });
});

describe("el aviso NO toca el pedido", () => {
  it("un recordatorio no cancela ni confirma nada", async () => {
    // Recordar y vencer son dos trabajos distintos. Si este cambiara estados,
    // un fallo suyo se convertiría en pedidos cancelados por error.
    driverFalso();
    const p = await pedidoQueVenceEn(30 * 60_000);

    await sendPaymentReminders(AHORA);

    const despues = await db.order.findUniqueOrThrow({ where: { id: p.id } });
    expect(despues.status).toBe("PENDING");
    expect(despues.expiresAt?.getTime()).toBe(p.expiresAt?.getTime());
  });
});

describe("la antelación se DERIVA de la vigencia", () => {
  it("con 24 h de vigencia avisa una hora antes", () => {
    expect(leadTimeMs(24 * HORA)).toBe(HORA);
  });

  it("🔒 con una vigencia corta NO avisa desde el primer instante", () => {
    // Si la antelación fuera una hora fija y alguien bajara la vigencia a 30
    // minutos, TODO pedido entraría en la ventana nada más crearse: el
    // recordatorio se convertiría en un segundo correo inmediato.
    expect(leadTimeMs(30 * 60_000)).toBe(15 * 60_000);
    expect(leadTimeMs(30 * 60_000)).toBeLessThan(30 * 60_000);
  });
});

describe("el texto del recordatorio", () => {
  it("dice cuánto queda y lleva el enlace de WhatsApp", async () => {
    const enviados = driverFalso();
    await pedidoQueVenceEn(55 * 60_000);

    await sendPaymentReminders(AHORA);

    expect(enviados).toHaveLength(1);
    const m = enviados[0];
    expect(m.subject).toContain("está por vencer");
    // El pago ocurre por WhatsApp: sin el enlace, el recordatorio le dice al
    // comprador que corre prisa y no le da por dónde.
    expect(m.html).toContain("api.whatsapp.com");
    // No es publicidad: no lleva baja.
    expect(m.unsubscribeUrl).toBeFalsy();
  });
});
