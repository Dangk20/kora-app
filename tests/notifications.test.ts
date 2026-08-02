// Correos transaccionales del pedido. Lo que se fija aquí:
//   1. LAS DOS LISTAS SON DISTINTAS: la baja de marketing NO frena el
//      comprobante de una compra; una dirección que rebotó frena todo.
//   2. El mismo correo no sale dos veces, ni con el evento repetido ni con dos
//      procesos a la vez. Y si el proveedor falla, SÍ se puede reintentar.
//   3. El correo NUNCA rompe la venta.
//   4. Un comprobante no ofrece darse de baja; una campaña sí.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { _resetEmailDriver } from "@/modules/email";
import * as emailModule from "@/modules/email";
import { renderCampaign } from "@/modules/email/template";
import { registerAllHandlers } from "@/modules/events/handlers";
import {
  orderCancelledBuyerEmail,
  orderConfirmedBuyerEmail,
  orderCreatedBuyerEmail,
  orderCreatedStaffEmail,
  orderDeliveredBuyerEmail,
  orderPreparingBuyerEmail,
  orderShippedBuyerEmail,
} from "@/modules/events/handlers/order-emails";
import { handlersFor, resetRegistry } from "@/modules/events/registry";
import type { DomainEventRecord } from "@/modules/events/types";
import { canSendMarketing, canSendTransactional } from "@/modules/notifications/guard";
import { orderEmailContext } from "@/modules/notifications/order-data";
import { renderOrderEmail } from "@/modules/notifications/render";
import { sendOrderEmail } from "@/modules/notifications/send";
import { setStaffEmail, STAFF_EMAIL_KEY, staffEmail } from "@/modules/notifications/settings";

const PREFIJO = "zzt-notif";

let n = 0;
const correo = () => `${PREFIJO}-${++n}-${Date.now()}@test.local`;

async function cliente(over: { acceptsMarketing?: boolean; emailUsable?: boolean } = {}) {
  return db.customer.create({
    data: {
      name: `${PREFIJO} ${n}`,
      email: correo(),
      acceptsMarketing: over.acceptsMarketing ?? true,
      emailUsable: over.emailUsable ?? true,
    },
  });
}

async function pedido(
  customerId: string | null,
  over: { total?: number; currency?: "COP" | "USD"; email?: string | null } = {},
) {
  const total = over.total ?? 100_000;
  return db.order.create({
    data: {
      channel: "WEB",
      status: "PENDING",
      currency: over.currency ?? "COP",
      customerId,
      subtotal: total,
      total,
      note: PREFIJO,
      contactName: "Laura Gómez",
      contactEmail: over.email === undefined ? correo() : over.email,
      whatsappMessage: "Hola KORA, quiero confirmar mi pedido",
      expiresAt: new Date(Date.now() + 2 * 3600_000),
      items: {
        create: [
          {
            variantId: (await db.variant.findFirstOrThrow({ select: { id: true } })).id,
            qty: 2,
            unitPrice: total / 2,
            total,
            productName: "Camiseta Essential",
            variantName: "Talla M",
            sku: "ZZT-1",
          },
        ],
      },
    },
  });
}

/** Un driver de mentira: no toca disco y se puede hacer fallar a voluntad. */
function driverFalso(opts: { falla?: boolean } = {}) {
  const enviados: { to: string; subject: string; unsubscribeUrl?: string }[] = [];
  vi.spyOn(emailModule, "emailDriver").mockReturnValue({
    name: "falso",
    async send(msg) {
      if (opts.falla) return { ok: false, error: "proveedor caído", permanent: false };
      enviados.push({ to: msg.to, subject: msg.subject, unsubscribeUrl: msg.unsubscribeUrl });
      return { ok: true, providerId: `fake-${enviados.length}` };
    },
  });
  return enviados;
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  const pedidos = await db.order.findMany({ where: { note: PREFIJO }, select: { id: true } });
  const pids = pedidos.map((p) => p.id);

  if (pids.length > 0) {
    await db.orderEmail.deleteMany({ where: { orderId: { in: pids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: pids } } });
    await db.orderStatusHistory.deleteMany({ where: { orderId: { in: pids } } });
    await db.order.deleteMany({ where: { id: { in: pids } } });
  }
  if (ids.length > 0) {
    await db.cashbackMovement.deleteMany({ where: { customerId: { in: ids } } });
    await db.customer.deleteMany({ where: { id: { in: ids } } });
  }
  await db.setting.deleteMany({ where: { key: STAFF_EMAIL_KEY } });
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

// ─────────────────────────────────────────────────────────────
describe("LAS DOS LISTAS SON DISTINTAS", () => {
  it("QUIEN SE DIO DE BAJA DE PROMOCIONES SÍ RECIBE EL CORREO DE SU PEDIDO", async () => {
    // Es un comprobante, no publicidad. Negárselo lo deja sin el número de
    // pedido, sin el detalle de lo que pagó y sin el enlace para cerrar el
    // cobro por WhatsApp — que es todo lo que tiene.
    const c = await cliente({ acceptsMarketing: false });

    expect(await canSendTransactional(c.email)).toMatchObject({ ok: true });
    expect(await canSendMarketing(c.id)).toMatchObject({
      ok: false,
      reason: "BAJA_DE_MARKETING",
    });
  });

  it("una dirección que rebotó NO recibe nada, ni campaña ni comprobante", async () => {
    const c = await cliente({ emailUsable: false });

    expect(await canSendTransactional(c.email)).toMatchObject({
      ok: false,
      reason: "DIRECCION_NO_UTILIZABLE",
    });
    expect(await canSendMarketing(c.id)).toMatchObject({
      ok: false,
      reason: "DIRECCION_NO_UTILIZABLE",
    });
  });

  it("un pedido sin correo no es un error, solo no se envía", async () => {
    expect(await canSendTransactional(null)).toMatchObject({ ok: false, reason: "SIN_CORREO" });
    expect(await canSendTransactional("   ")).toMatchObject({ ok: false, reason: "SIN_CORREO" });
  });

  it("una dirección que no es de ningún cliente sí recibe: nada la marca como muerta", async () => {
    // Un invitado que compró sin quedar registrado igual necesita su
    // comprobante.
    expect(await canSendTransactional("desconocido@test.local")).toMatchObject({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe("el mismo correo no sale dos veces", () => {
  it("EL MISMO EVENTO DOS VECES manda UN correo", async () => {
    const enviados = driverFalso();
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;
    const email = renderOrderEmail("BUYER_CREATED", ctx);

    const a = await sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email });
    const b = await sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email });

    expect(a).toMatchObject({ sent: true });
    expect(b).toMatchObject({ sent: false, reason: "YA_ENVIADO" });
    expect(enviados).toHaveLength(1);
    expect(await db.orderEmail.count({ where: { orderId: p.id } })).toBe(1);
  });

  it("DOS PROCESOS A LA VEZ mandan UNO", async () => {
    const enviados = driverFalso();
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;
    const email = renderOrderEmail("BUYER_CREATED", ctx);

    const r = await Promise.all([
      sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email }),
      sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email }),
    ]);

    expect(r.filter((x) => x.sent)).toHaveLength(1);
    expect(enviados).toHaveLength(1);
  });

  it("SI EL PROVEEDOR FALLA, el reintento SÍ puede volver a intentarlo", async () => {
    // Sin esto la reserva quedaría puesta para siempre y el correo no saldría
    // nunca: la protección contra duplicados se habría comido el envío.
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;
    const email = renderOrderEmail("BUYER_CREATED", ctx);

    driverFalso({ falla: true });
    const fallo = await sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email });
    expect(fallo).toMatchObject({ sent: false, reason: "FALLO_PROVEEDOR" });

    vi.restoreAllMocks();
    const enviados = driverFalso();
    const bueno = await sendOrderEmail({ orderId: p.id, type: "BUYER_CREATED", to: ctx.buyerEmail, email });

    expect(bueno).toMatchObject({ sent: true });
    expect(enviados).toHaveLength(1);
    // Sigue habiendo UNA fila: la reserva se reutiliza, no se duplica.
    expect(await db.orderEmail.count({ where: { orderId: p.id } })).toBe(1);
    const fila = await db.orderEmail.findFirstOrThrow({ where: { orderId: p.id } });
    expect(fila.sentAt).not.toBeNull();
    expect(fila.attempts).toBeGreaterThanOrEqual(2);
  });

  it("tipos distintos del mismo pedido son correos distintos", async () => {
    const enviados = driverFalso();
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    await sendOrderEmail({
      orderId: p.id,
      type: "BUYER_CREATED",
      to: ctx.buyerEmail,
      email: renderOrderEmail("BUYER_CREATED", ctx),
    });
    await sendOrderEmail({
      orderId: p.id,
      type: "BUYER_CONFIRMED",
      to: ctx.buyerEmail,
      email: renderOrderEmail("BUYER_CONFIRMED", ctx),
    });

    expect(enviados).toHaveLength(2);
  });

  it("a una dirección suprimida no se le reserva nada", async () => {
    const enviados = driverFalso();
    const c = await cliente({ emailUsable: false });
    const p = await pedido(c.id, { email: c.email });
    const ctx = (await orderEmailContext(p.id))!;

    const r = await sendOrderEmail({
      orderId: p.id,
      type: "BUYER_CREATED",
      to: ctx.buyerEmail,
      email: renderOrderEmail("BUYER_CREATED", ctx),
    });

    expect(r).toMatchObject({ sent: false, reason: "NO_ENVIABLE" });
    expect(enviados).toHaveLength(0);
    expect(await db.orderEmail.count({ where: { orderId: p.id } })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe("lo que dice cada correo", () => {
  it("UN COMPROBANTE NO OFRECE DARSE DE BAJA; una campaña sí", async () => {
    // Ofrecer la baja en una factura promete algo que no se va a cumplir —el
    // siguiente pedido generará su correo igual— y marca el mensaje como
    // comercial ante los filtros.
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const comprobante = renderOrderEmail("BUYER_CREATED", ctx);
    expect(comprobante.html).not.toContain("Cancelar suscripción");
    expect(comprobante.text).not.toContain("Cancelar suscripción");

    const campana = renderCampaign({
      subject: "Promo",
      title: "Promo",
      body: "Texto",
      products: [],
      unsubscribeUrl: "https://korashopp.com/suscripcion/baja?t=x",
    });
    expect(campana.html).toContain("Cancelar suscripción");
  });

  it("el correo del pedido lleva el número, el detalle y el enlace de WhatsApp", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_CREATED", ctx);
    expect(email.subject).toContain(ctx.orderNumber);
    expect(email.html).toContain("Camiseta Essential");
    // Sin este enlace, quien cerró la pestaña no tiene forma de volver — y el
    // pedido expira en 2 horas.
    expect(email.html).toContain("api.whatsapp.com/send");
    expect(email.html).not.toContain("wa.me");
  });

  it("LOS IMPORTES SALEN EN LA MONEDA DEL PEDIDO", async () => {
    const c = await cliente();
    const p = await pedido(c.id, { currency: "USD", total: 40 });
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_CREATED", ctx);
    expect(email.html).toContain("40");
    expect(email.html).toContain("USD");
    // Ni rastro del símbolo de pesos colombianos con formato local.
    expect(email.text).not.toMatch(/\$\s?40\.000/);
  });

  it("el correo de confirmación dice cuánto cashback ganó y cuándo vence", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_CONFIRMED", {
      ...ctx,
      cashbackEarned: 3_000,
      cashbackExpiresAt: new Date("2027-08-01T05:00:00Z"),
    });

    expect(email.html).toContain("Kora Cashback");
    expect(email.html).toContain("2027");
  });

  it("el aviso de expiración dice que se devolvió el cashback", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_CANCELLED", {
      ...ctx,
      cancelReason: "EXPIRED",
      cashbackRefunded: 5_000,
    });

    expect(email.html).toContain("expiró");
    expect(email.html).toContain("Devolvimos");
  });

  it("el aviso al operador lleva el enlace directo al pedido en el panel", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("STAFF_NEW_ORDER", ctx);
    expect(email.html).toContain(`/admin/pedidos/${p.id}`);
    // El asunto tiene que bastar para decidir si se atiende ahora: quedan 2 h.
    expect(email.subject).toContain(ctx.orderNumber);
  });
});

// ─────────────────────────────────────────────────────────────
describe("EL CORREO NUNCA ROMPE LA VENTA", () => {
  it("la creación y la confirmación del pedido NO llaman al envío", async () => {
    // La garantía es estructural, no de buena intención: si el envío se
    // invocara desde la acción, un proveedor lento convertiría el checkout en
    // una espera y uno caído, en una venta perdida. Todo cuelga de la bandeja
    // de salida, y esta prueba lo fija por si alguien "simplifica" mañana.
    const fuente = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

    for (const archivo of [
      "src/modules/orders/checkout-actions.ts",
      "src/modules/orders/actions.ts",
      "src/modules/orders/expire.ts",
    ]) {
      const src = fuente(archivo);
      expect(src, `${archivo} no debe enviar correo`).not.toContain("modules/notifications/send");
      expect(src, `${archivo} no debe elegir driver de correo`).not.toContain("emailDriver");
    }
  });

  it("con el proveedor caído, el manejador falla pero el PEDIDO queda intacto", async () => {
    driverFalso({ falla: true });
    const c = await cliente();
    const p = await pedido(c.id);

    resetRegistry();
    registerAllHandlers();

    const evento: DomainEventRecord = {
      id: "evt-fallo",
      type: "order.created",
      payload: { orderId: p.id },
      attempts: 1,
      createdAt: new Date(),
    };

    // El manejador lanza para que la bandeja reintente…
    await expect(orderCreatedBuyerEmail.handle(evento)).rejects.toThrow(/No se pudo enviar/);

    // …y el pedido sigue exactamente como estaba.
    const despues = await db.order.findUniqueOrThrow({ where: { id: p.id } });
    expect(despues.status).toBe("PENDING");
    expect(Number(despues.total)).toBe(100_000);
  });

  it("de punta a punta: el worker manda los dos correos del pedido nuevo", async () => {
    const enviados = driverFalso();
    await setStaffEmail("pedidos@korashopp.com");
    const c = await cliente();
    const p = await pedido(c.id);

    resetRegistry();
    registerAllHandlers();

    const evento: DomainEventRecord = {
      id: "evt-ok",
      type: "order.created",
      payload: { orderId: p.id },
      attempts: 1,
      createdAt: new Date(),
    };
    await orderCreatedBuyerEmail.handle(evento);
    await orderCreatedStaffEmail.handle(evento);

    expect(enviados).toHaveLength(2);
    expect(enviados.map((e) => e.to)).toContain("pedidos@korashopp.com");
    // Ninguno de los dos lleva cabecera de baja: no son comerciales.
    expect(enviados.every((e) => !e.unsubscribeUrl)).toBe(true);

    resetRegistry();
  });

  it("sin dirección del negocio no se falla: se deja constancia y el pedido sigue", async () => {
    const enviados = driverFalso();
    const c = await cliente();
    const p = await pedido(c.id);

    await expect(
      orderCreatedStaffEmail.handle({
        id: "evt-sin-destino",
        type: "order.created",
        payload: { orderId: p.id },
        attempts: 1,
        createdAt: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(enviados).toHaveLength(0);
    const nota = await db.orderStatusHistory.findFirst({ where: { orderId: p.id } });
    expect(nota?.note).toContain("sin dirección del negocio");
  });
});

// ─────────────────────────────────────────────────────────────
describe("UN CORREO POR CADA ESTADO DEL PEDIDO", () => {
  // Decisión del cliente (1 ago 2026): el comprador no tiene otra ventana a su
  // pedido, y cada cambio sin avisar es una pregunta por WhatsApp que alguien
  // contesta a mano.
  const MOMENTOS = [
    { evento: "order.created", handler: orderCreatedBuyerEmail, tipo: "BUYER_CREATED" },
    { evento: "order.confirmed", handler: orderConfirmedBuyerEmail, tipo: "BUYER_CONFIRMED" },
    { evento: "order.preparing", handler: orderPreparingBuyerEmail, tipo: "BUYER_PREPARING" },
    { evento: "order.shipped", handler: orderShippedBuyerEmail, tipo: "BUYER_SHIPPED" },
    { evento: "order.delivered", handler: orderDeliveredBuyerEmail, tipo: "BUYER_DELIVERED" },
    { evento: "order.cancelled", handler: orderCancelledBuyerEmail, tipo: "BUYER_CANCELLED" },
  ] as const;

  it("cada estado manda SU correo, y solo el suyo", async () => {
    const enviados = driverFalso();
    const c = await cliente();
    const p = await pedido(c.id);

    for (const m of MOMENTOS) {
      await m.handler.handle({
        id: `evt-${m.tipo}`,
        type: m.evento,
        payload: { orderId: p.id },
        attempts: 1,
        createdAt: new Date(),
      });
    }

    // Seis correos al comprador, uno por momento, sin repetidos.
    expect(enviados).toHaveLength(MOMENTOS.length);
    const tipos = await db.orderEmail.findMany({
      where: { orderId: p.id },
      select: { type: true },
    });
    expect(tipos.map((t) => t.type).sort()).toEqual(MOMENTOS.map((m) => m.tipo).sort());
  });

  it("TODOS los estados tienen su tipo de correo registrado", () => {
    // Si mañana se añade un estado al pedido y nadie le pone correo, el
    // comprador se queda sin aviso y nada falla. Esto lo hace visible.
    resetRegistry();
    registerAllHandlers();

    for (const m of MOMENTOS) {
      const registrados = handlersFor(m.evento);
      expect(registrados.length, `${m.evento} sin manejador`).toBeGreaterThan(0);
    }
    resetRegistry();
  });

  it("el correo de entrega recuerda el cashback y la ventana de cambios", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_DELIVERED", {
      ...ctx,
      cashbackEarned: 5_550,
      cashbackExpiresAt: new Date("2027-08-01T05:00:00Z"),
    });

    expect(email.html).toContain("Kora Cashback");
    // La ventana es de 30 días desde la compra: si no se recuerda aquí, el
    // comprador se entera cuando ya pasó.
    expect(email.html).toContain("30 días");
  });

  it("el de preparación no promete entrega ni pide nada", async () => {
    const c = await cliente();
    const p = await pedido(c.id);
    const ctx = (await orderEmailContext(p.id))!;

    const email = renderOrderEmail("BUYER_PREPARING", ctx);
    expect(email.subject).toContain(ctx.orderNumber);
    expect(email.html).toContain("preparación");
  });
});

// ─────────────────────────────────────────────────────────────
describe("la dirección del negocio", () => {
  it("sin configurar devuelve null, sin inventarse un destino", async () => {
    // Un valor por defecto mandaría los pedidos del cliente a un buzón nuestro
    // sin que nadie lo hubiera decidido.
    expect(await staffEmail()).toBeNull();
  });

  it("se puede poner y se normaliza", async () => {
    await setStaffEmail("  Pedidos@KoraShopp.com ");
    expect(await staffEmail()).toBe("pedidos@korashopp.com");
  });
});
