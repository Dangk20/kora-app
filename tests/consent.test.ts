// Consentimiento, baja y supresión. Esto es cumplimiento legal (Ley 1581 en
// Colombia, CAN-SPAM en EE.UU.) y reputación del dominio:
//   1. Nadie puede dar de baja a otro adivinando una dirección.
//   2. Volver a comprar NO re-suscribe a quien se dio de baja.
//   3. Cada cambio deja constancia con fecha y origen; nada se sobrescribe.
//   4. Rebote y queja son idempotentes: el mismo aviso dos veces no cambia nada.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  consentHistory,
  resubscribe,
  setSubscription,
  subscribeFromCheckout,
  subscriberCount,
  subscriptionState,
  unsubscribeByLink,
} from "@/modules/consent/subscription";
import { markEmailUsable, recordHardBounce, recordSpamComplaint } from "@/modules/consent/suppression";
import { resolveOrderCustomer } from "@/modules/orders/customer-link";
import {
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "@/modules/consent/token";

const PREFIJO = "zzt-consent";

let n = 0;
async function cliente(over: { subscribed?: boolean; email?: string | null } = {}) {
  n += 1;
  return db.customer.create({
    data: {
      name: `${PREFIJO} ${n}`,
      email: over.email === null ? null : (over.email ?? `${PREFIJO}-${n}-${Date.now()}@test.local`),
      acceptsMarketing: over.subscribed ?? true,
    },
  });
}

async function limpiar() {
  const ids = (
    await db.customer.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length === 0) return;
  await db.consentEvent.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(limpiar);
afterEach(limpiar);

// ─────────────────────────────────────────────────────────────
describe("el enlace de baja está firmado", () => {
  it("un enlace legítimo identifica a su cliente", () => {
    const token = unsubscribeToken("cliente-123");
    expect(verifyUnsubscribeToken(token)).toBe("cliente-123");
  });

  it("NADIE PUEDE DAR DE BAJA A OTRO cambiando el identificador", () => {
    // Sin firma, cualquiera recorrería identificadores y daría de baja a toda
    // la base — un ataque silencioso que solo se notaría cuando las campañas
    // dejaran de llegar a nadie.
    const token = unsubscribeToken("cliente-123");
    const manipulado = token.replace("cliente-123", "cliente-456");
    expect(verifyUnsubscribeToken(manipulado)).toBeNull();
  });

  it("una firma alterada no sirve", () => {
    const token = unsubscribeToken("cliente-123");
    expect(verifyUnsubscribeToken(token.slice(0, -1) + "X")).toBeNull();
    expect(verifyUnsubscribeToken("cliente-123")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("basura.basura")).toBeNull();
  });

  it("el enlace del correo apunta a la página pública de baja", () => {
    const url = unsubscribeUrl("cliente-123");
    expect(url).toContain("/suscripcion/baja?t=");
    expect(verifyUnsubscribeToken(decodeURIComponent(url.split("t=")[1]))).toBe("cliente-123");
  });
});

// ─────────────────────────────────────────────────────────────
describe("estado y registro", () => {
  it("cada cambio deja constancia con fecha y origen", async () => {
    const c = await cliente({ subscribed: false });

    await setSubscription({ customerId: c.id, subscribed: true, source: "CHECKOUT" });
    await unsubscribeByLink(c.id);
    await resubscribe(c.id);

    const historial = await consentHistory(c.id);
    expect(historial.map((h) => h.source)).toEqual(["RESUBSCRIBE", "UNSUBSCRIBE_LINK", "CHECKOUT"]);
    expect(historial.every((h) => h.createdAt instanceof Date)).toBe(true);
  });

  it("la baja tiene efecto inmediato", async () => {
    const c = await cliente();
    expect((await subscriptionState(c.id)).reachable).toBe(true);

    await unsubscribeByLink(c.id);

    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(false);
    expect(estado.reachable).toBe(false);
    expect(estado.source).toBe("UNSUBSCRIBE_LINK");
  });

  it("un cliente sin correo nunca es alcanzable", async () => {
    const c = await cliente({ email: null });
    expect((await subscriptionState(c.id)).reachable).toBe(false);
  });

  it("el conteo de suscritos solo cuenta a quien puede recibir", async () => {
    const antes = await subscriberCount();
    await cliente({ subscribed: true });
    await cliente({ subscribed: false });
    await cliente({ email: null });
    expect(await subscriberCount()).toBe(antes + 1);
  });
});

// ─────────────────────────────────────────────────────────────
describe("volver a comprar NO re-suscribe", () => {
  it("un cliente dado de baja sigue dado de baja tras un pedido nuevo", async () => {
    // Si una compra reactivara la suscripción, la baja no significaría nada —
    // que es exactamente lo que la ley prohíbe.
    const c = await cliente();
    await unsubscribeByLink(c.id);

    await subscribeFromCheckout(c.id, true);

    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(false);
    expect(estado.source).toBe("UNSUBSCRIBE_LINK");
  });

  it("un cliente nuevo que acepta queda suscrito con origen checkout", async () => {
    const c = await cliente({ subscribed: false });
    await subscribeFromCheckout(c.id, true);
    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(true);
    expect(estado.source).toBe("CHECKOUT");
  });

  it("si no acepta, no se suscribe ni se registra nada", async () => {
    const c = await cliente({ subscribed: false });
    await subscribeFromCheckout(c.id, false);
    expect((await subscriptionState(c.id)).subscribed).toBe(false);
    expect(await consentHistory(c.id)).toHaveLength(0);
  });

  it("EL CHECKOUT NO RE-SUSCRIBE por la puerta de atrás", async () => {
    // `resolveOrderCustomer` llegó a hacer `found.acceptsMarketing || input`,
    // y eso resucitaba la suscripción con solo volver a comprar. La baja tiene
    // que sobrevivir a un pedido nuevo aunque el formulario venga marcado.
    const c = await cliente();
    await unsubscribeByLink(c.id);

    const r = await db.$transaction((tx) =>
      resolveOrderCustomer(tx, {
        buyerCustomerId: c.id,
        name: c.name,
        email: c.email!,
        phone: `+5730${String(Date.now() % 100000000).padStart(8, "0")}`,
        country: "CO",
        city: "Bogotá",
        address: "Calle 1 # 2 - 3",
        acceptsMarketing: true, // el checkbox venía marcado
      }),
    );

    expect(r.acceptsMarketing).toBe(false);
    expect((await subscriptionState(c.id)).subscribed).toBe(false);
  });

  it("la reactivación por decisión del cliente sí funciona", async () => {
    const c = await cliente();
    await unsubscribeByLink(c.id);
    await resubscribe(c.id);
    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(true);
    expect(estado.source).toBe("RESUBSCRIBE");
  });
});

// ─────────────────────────────────────────────────────────────
describe("supresión automática", () => {
  it("un rebote duro marca el correo como no utilizable, sin dar de baja", async () => {
    // El consentimiento sigue siendo válido: lo que falla es la dirección. Si
    // la corrige, vuelve a ser alcanzable sin pedirle permiso otra vez.
    const c = await cliente();

    const r = await recordHardBounce(c.email!);

    expect(r).toMatchObject({ applied: true, customerId: c.id });
    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(true);
    expect(estado.emailUsable).toBe(false);
    expect(estado.reachable).toBe(false);
  });

  it("una queja de spam da de baja de inmediato", async () => {
    const c = await cliente();
    const r = await recordSpamComplaint(c.email!);

    expect(r.applied).toBe(true);
    const estado = await subscriptionState(c.id);
    expect(estado.subscribed).toBe(false);
    expect(estado.source).toBe("SPAM_COMPLAINT");
  });

  it("EL MISMO AVISO DOS VECES no cambia nada ni duplica el registro", async () => {
    const c = await cliente();

    await recordHardBounce(c.email!);
    const segunda = await recordHardBounce(c.email!);
    expect(segunda.applied).toBe(false);

    await recordSpamComplaint(c.email!);
    const otra = await recordSpamComplaint(c.email!);
    expect(otra.applied).toBe(false);

    const rebotes = (await consentHistory(c.id)).filter((h) => h.source === "BOUNCE");
    const quejas = (await consentHistory(c.id)).filter((h) => h.source === "SPAM_COMPLAINT");
    expect(rebotes).toHaveLength(1);
    expect(quejas).toHaveLength(1);
  });

  it("un aviso de un correo desconocido no hace nada", async () => {
    const r = await recordHardBounce("no-existe-en-kora@test.local");
    expect(r).toEqual({ applied: false, customerId: null });
  });

  it("corregir el correo lo vuelve utilizable", async () => {
    const c = await cliente();
    await recordHardBounce(c.email!);
    await markEmailUsable(c.id);
    expect((await subscriptionState(c.id)).reachable).toBe(true);
  });
});
