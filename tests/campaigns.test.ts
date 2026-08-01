// Campañas. Aquí un error se convierte en correos duplicados, y eso no se
// deshace: le llega al comprador y las quejas queman la reputación del dominio.
//   1. REANUDAR tras una caída no reenvía a nadie.
//   2. Dos despachadores a la vez no duplican.
//   3. Quien se da de baja a mitad del envío NO recibe — segunda barrera.
//   4. Una campaña solo puede empezar a enviarse una vez.
//   5. El contenido se congela: un precio que cambia no altera lo ya enviado.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  countAudience,
  describeSegment,
  segmentWhere,
  SEGMENTO_VACIO,
} from "@/modules/campaigns/audience";
import { audienceCurrency, validateContent } from "@/modules/campaigns/content";
import { dispatchBatch, dispatchOnce, releaseOrphanReservations } from "@/modules/campaigns/dispatch";
import { startCampaign, startDueCampaigns } from "@/modules/campaigns/send";
import { canTransition, isCancellable, isDeletable, isEditable } from "@/modules/campaigns/status";
import { unsubscribeByLink } from "@/modules/consent/subscription";
import { _resetEmailDriver } from "@/modules/email";

const PREFIJO = "zzt-camp";

let n = 0;
async function cliente(over: { subscribed?: boolean; country?: string } = {}) {
  n += 1;
  return db.customer.create({
    data: {
      name: `${PREFIJO} ${n}`,
      email: `${PREFIJO}-${n}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`,
      acceptsMarketing: over.subscribed ?? true,
      country: over.country ?? "CO",
    },
  });
}

let usuarioId: string | null = null;
async function operador() {
  if (usuarioId) return usuarioId;
  const u = await db.user.findFirst({ where: { email: "admin@kora.local" }, select: { id: true } });
  usuarioId = u!.id;
  return usuarioId;
}

async function campana(over: Partial<Parameters<typeof db.campaign.create>[0]["data"]> = {}) {
  return db.campaign.create({
    data: {
      name: `${PREFIJO} campaña ${++n}`,
      subject: "Promoción de prueba",
      title: "Lo nuevo de KORA",
      body: "Texto de la campaña.",
      segment: SEGMENTO_VACIO as unknown as object,
      createdById: await operador(),
      ...over,
    } as Parameters<typeof db.campaign.create>[0]["data"],
  });
}

async function limpiar() {
  const camp = await db.campaign.findMany({
    where: { name: { startsWith: PREFIJO } },
    select: { id: true },
  });
  if (camp.length > 0) {
    await db.campaignRecipient.deleteMany({ where: { campaignId: { in: camp.map((c) => c.id) } } });
    await db.campaign.deleteMany({ where: { id: { in: camp.map((c) => c.id) } } });
  }
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.campaignRecipient.deleteMany({ where: { customerId: { in: ids } } });
  await db.consentEvent.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Aparta a los clientes reales mientras corre la prueba.
 *
 * La audiencia de una campaña no filtra por prefijo —no debe hacerlo, su
 * trabajo es alcanzar a quien corresponde— así que en una base de desarrollo
 * con clientes reales acabaría enviándoles correos de prueba y falseando todo
 * conteo exacto. En CI la base es efímera y daría igual; en la máquina de
 * alguien, no. Desuscribirlos temporalmente los hace invisibles sin borrarlos.
 */
let apartados: string[] = [];

async function apartarReales() {
  const reales = await db.customer.findMany({
    where: { acceptsMarketing: true, NOT: { name: { startsWith: PREFIJO } } },
    select: { id: true },
  });
  apartados = reales.map((c) => c.id);
  if (apartados.length > 0) {
    await db.customer.updateMany({
      where: { id: { in: apartados } },
      data: { acceptsMarketing: false },
    });
  }
}

async function devolverReales() {
  if (apartados.length === 0) return;
  await db.customer.updateMany({
    where: { id: { in: apartados } },
    data: { acceptsMarketing: true },
  });
  apartados = [];
}

beforeEach(async () => {
  _resetEmailDriver();
  process.env.EMAIL_DEV_DIR = ".emails-test";
  await limpiar();
  await apartarReales();
});
afterEach(async () => {
  await devolverReales();
  await limpiar();
});

/** Los destinatarios de una campaña, por estado. */
async function porEstado(campaignId: string) {
  const filas = await db.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: true,
  });
  return Object.fromEntries(filas.map((f) => [f.status, f._count]));
}

// ─────────────────────────────────────────────────────────────
describe("estados", () => {
  it("las transiciones son las únicas permitidas y no retroceden", () => {
    expect(canTransition("DRAFT", "SENDING")).toBe(true);
    expect(canTransition("SCHEDULED", "CANCELLED")).toBe(true);
    expect(canTransition("SENDING", "SENT")).toBe(true);
    // Una enviada es histórico: no vuelve a borrador ni se cancela.
    expect(canTransition("SENT", "DRAFT")).toBe(false);
    expect(canTransition("SENT", "CANCELLED")).toBe(false);
    expect(canTransition("SENDING", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "SENDING")).toBe(false);
  });

  it("lo que ya salió no se edita ni se borra, y no se cancela a medias", () => {
    expect(isEditable("DRAFT")).toBe(true);
    expect(isEditable("SENDING")).toBe(false);
    expect(isEditable("SENT")).toBe(false);
    expect(isDeletable("SENT")).toBe(false);
    // Los correos ya están saliendo: el botón mentiría.
    expect(isCancellable("SENDING")).toBe(false);
    expect(isCancellable("SCHEDULED")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe("contenido", () => {
  it("valida lo obligatorio y los topes", () => {
    const vacio = validateContent({
      name: "",
      subject: "",
      preheader: null,
      title: "",
      body: "",
      imageKey: null,
      ctaLabel: null,
      ctaUrl: null,
      productIds: [],
    });
    expect(vacio.map((p) => p.field)).toEqual(["name", "subject", "title", "body"]);

    const largo = validateContent({
      name: "Campaña",
      subject: "x".repeat(81),
      preheader: null,
      title: "T",
      body: "B",
      imageKey: null,
      ctaLabel: null,
      ctaUrl: null,
      productIds: Array.from({ length: 7 }, (_, i) => `p${i}`),
    });
    expect(largo.map((p) => p.field).sort()).toEqual(["productIds", "subject"]);
  });

  it("la moneda del correo sale del país de la audiencia; mixta = sin precio", () => {
    expect(audienceCurrency({ ...SEGMENTO_VACIO, country: "CO" })).toBe("COP");
    expect(audienceCurrency({ ...SEGMENTO_VACIO, country: "US" })).toBe("USD");
    // Mixta: null ⇒ los productos van sin precio. No hay tasa de cambio.
    expect(audienceCurrency({ ...SEGMENTO_VACIO, country: "ambos" })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe("audiencia", () => {
  it("la base elegible exige suscripción, correo y correo utilizable", () => {
    const w = segmentWhere(SEGMENTO_VACIO) as { AND: Record<string, unknown>[] };
    expect(w.AND[0]).toEqual({
      acceptsMarketing: true,
      emailUsable: true,
      email: { not: null },
    });
  });

  it("UN DESUSCRITO NUNCA ENTRA en la audiencia", async () => {
    await cliente({ subscribed: true });
    await cliente({ subscribed: false });
    expect(await countAudience(SEGMENTO_VACIO)).toBe(1);
  });

  it("el filtro de país intersecta", async () => {
    await cliente({ country: "CO" });
    await cliente({ country: "US" });
    expect(await countAudience({ ...SEGMENTO_VACIO, country: "CO" })).toBe(1);
    expect(await countAudience({ ...SEGMENTO_VACIO, country: "US" })).toBe(1);
    expect(await countAudience(SEGMENTO_VACIO)).toBe(2);
  });

  it("describe el segmento de forma legible para el listado", () => {
    expect(describeSegment({ ...SEGMENTO_VACIO, country: "CO", activity: "activos_30" })).toBe(
      "CO · activos 30 d",
    );
    expect(
      describeSegment(
        { ...SEGMENTO_VACIO, account: "con_cuenta", categoryIds: ["x"] },
        ["Tecnología"],
      ),
    ).toBe("CO + US · todos · con cuenta · Tecnología");
  });
});

// ─────────────────────────────────────────────────────────────
describe("iniciar el envío", () => {
  it("congela la audiencia y el contenido", async () => {
    const c = await cliente();
    const camp = await campana();

    const r = await startCampaign(camp.id);

    expect(r.ok).toBe(true);
    const guardada = await db.campaign.findUnique({ where: { id: camp.id } });
    expect(guardada?.status).toBe("SENDING");
    // Copia inmutable: lo que se mandó, tal cual.
    expect(guardada?.sentHtml).toContain("Lo nuevo de KORA");
    expect(guardada?.sentText).toContain("LO NUEVO DE KORA"); // el texto plano titula en mayúsculas

    const mio = await db.campaignRecipient.findFirst({
      where: { campaignId: camp.id, customerId: c.id },
    });
    expect(mio?.email).toBe(c.email); // el correo, tal como estaba
    expect(mio?.status).toBe("PENDING");
  });

  it("UNA CAMPAÑA SOLO PUEDE EMPEZAR A ENVIARSE UNA VEZ", async () => {
    // El disparo puede venir del operador y del trabajo programado a la vez.
    // Si los dos ganaran, cada destinatario recibiría dos correos.
    await cliente();
    const camp = await campana();

    const [a, b] = await Promise.all([startCampaign(camp.id), startCampaign(camp.id)]);

    const exitos = [a, b].filter((r) => r.ok);
    expect(exitos).toHaveLength(1);
    expect(await db.campaignRecipient.count({ where: { campaignId: camp.id } })).toBe(
      exitos[0].ok ? exitos[0].recipients : 0,
    );
  });

  it("un segmento vacío no deja enviar", async () => {
    // Sin ningún cliente creado, la audiencia está vacía: enviar sería mandar
    // una campaña a nadie y dejarla marcada como enviada.
    const camp = await campana();
    const r = await startCampaign(camp.id);
    expect(r).toMatchObject({ ok: false });
    expect((await db.campaign.findUnique({ where: { id: camp.id } }))?.status).toBe("DRAFT");
  });

  it("una campaña ya enviada no se vuelve a enviar", async () => {
    await cliente();
    const camp = await campana();
    await startCampaign(camp.id);
    const segunda = await startCampaign(camp.id);
    expect(segunda).toMatchObject({ ok: false });
  });

  it("una programada se dispara al llegar su hora", async () => {
    await cliente();
    const camp = await campana({
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
    });

    const r = await startDueCampaigns();

    expect(r.started).toBeGreaterThanOrEqual(1);
    expect((await db.campaign.findUnique({ where: { id: camp.id } }))?.status).toBe("SENDING");
  });

  it("una programada para más tarde no se dispara", async () => {
    await cliente();
    const camp = await campana({
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 3600_000),
    });
    await startDueCampaigns();
    expect((await db.campaign.findUnique({ where: { id: camp.id } }))?.status).toBe("SCHEDULED");
  });
});

// ─────────────────────────────────────────────────────────────
describe("despachador", () => {
  it("envía el lote y termina la campaña cuando no queda nadie", async () => {
    await cliente();
    await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    const primera = await dispatchBatch(camp.id);
    expect(primera.sent).toBeGreaterThanOrEqual(2);

    const segunda = await dispatchBatch(camp.id);
    expect(segunda.finished).toBe(true);

    const guardada = await db.campaign.findUnique({ where: { id: camp.id } });
    expect(guardada?.status).toBe("SENT");
    expect(guardada?.sentAt).toBeTruthy();
    expect(guardada?.sentCount).toBeGreaterThanOrEqual(2);
  });

  it("REANUDAR TRAS UNA CAÍDA no reenvía a nadie", async () => {
    // Es la garantía central del módulo: un correo duplicado no se deshace.
    await cliente();
    await cliente();
    await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    // Primer lote de uno.
    await dispatchBatch(camp.id, 1);
    const trasPrimero = await porEstado(camp.id);
    expect(trasPrimero.SENT).toBe(1);

    // "Se cae el proceso" y vuelve: procesa el resto, no lo ya enviado.
    await dispatchBatch(camp.id, 10);
    const final = await porEstado(camp.id);
    expect(final.SENT).toBe(3);
    expect(final.PENDING ?? 0).toBe(0);

    // Nadie quedó con más de un intento de envío exitoso.
    const enviados = await db.campaignRecipient.findMany({
      where: { campaignId: camp.id, status: "SENT" },
    });
    expect(enviados.every((e) => e.attempts === 1)).toBe(true);
  });

  it("DOS DESPACHADORES A LA VEZ no duplican", async () => {
    for (let i = 0; i < 6; i++) await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    await Promise.all([dispatchBatch(camp.id, 10), dispatchBatch(camp.id, 10)]);

    const enviados = await db.campaignRecipient.findMany({
      where: { campaignId: camp.id, status: "SENT" },
    });
    // Cada destinatario, exactamente un envío.
    expect(enviados.every((e) => e.attempts === 1)).toBe(true);
    expect(new Set(enviados.map((e) => e.customerId)).size).toBe(enviados.length);
  });

  it("QUIEN SE DA DE BAJA A MITAD DEL ENVÍO no recibe — segunda barrera", async () => {
    // Entre armar la audiencia y el último lote pueden pasar horas. Quien se
    // da de baja en ese intervalo y aun así recibe tiene razón en quejarse.
    const a = await cliente();
    const b = await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    await unsubscribeByLink(b.id);

    await dispatchBatch(camp.id, 10);

    const estados = await db.campaignRecipient.findMany({ where: { campaignId: camp.id } });
    expect(estados.find((e) => e.customerId === a.id)?.status).toBe("SENT");
    expect(estados.find((e) => e.customerId === b.id)?.status).toBe("SKIPPED");
  });

  it("una reserva huérfana vuelve a pendiente", async () => {
    await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    // Un proceso que murió tras reservar.
    await db.campaignRecipient.updateMany({
      where: { campaignId: camp.id },
      data: { status: "SENDING", reservedAt: new Date(Date.now() - 30 * 60_000) },
    });

    const liberadas = await releaseOrphanReservations();
    expect(liberadas).toBeGreaterThanOrEqual(1);
    expect((await porEstado(camp.id)).PENDING).toBeGreaterThanOrEqual(1);
  });

  it("el despachador toma la campaña en curso más antigua", async () => {
    await cliente();
    const camp = await campana();
    await startCampaign(camp.id);

    const r = await dispatchOnce(10);
    expect(r.campaignId).toBe(camp.id);
  });

  it("sin campañas en curso no hace nada", async () => {
    // Puede haber campañas reales en curso en la base de desarrollo: lo que se
    // comprueba es que no se invente una donde no la hay.
    const enCurso = await db.campaign.count({ where: { status: "SENDING" } });
    const r = await dispatchOnce();
    if (enCurso === 0) expect(r.campaignId).toBeNull();
    else expect(r.campaignId).not.toBeNull();
  });
});
