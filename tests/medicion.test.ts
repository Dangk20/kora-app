// Medición publicitaria (change medicion-publicitaria).
//   1. Configuración: apagada, encendida o la app no arranca. Nunca a medias.
//   2. Origen: último toque no directo; una visita directa no borra el anuncio.
//   3. Datos a Meta normalizados y cifrados; nada personal a GA4.
//   4. La compra se informa UNA vez por pedido y plataforma, solo WEB y solo
//      con consentimiento.
//   5. La política de privacidad dice lo que la tienda hace.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { fallosDeArranque } from "@/lib/startup-guards";
import {
  fbcFromFbclid,
  gaClientIdFromCookie,
  gaSessionIdFromCookie,
  mergeTouch,
  parseTouch,
  serializeTouch,
  touchFromVisit,
} from "@/modules/measurement/attribution";
import { measurementPublicConfig, readMeasurementConfig } from "@/modules/measurement/config";
import { normEmail, normPhone, normPlace, sha256, splitName } from "@/modules/measurement/hash";
import { buildGa4Purchase, buildMetaPurchase, type ConfirmedOrder } from "@/modules/measurement/purchase";
import {
  orderConfirmedGa4Handler,
  orderConfirmedMetaHandler,
} from "@/modules/events/handlers/order-confirmed-measurement";
import { legalDocument } from "@/modules/legal/content";
import { merchant } from "@/modules/legal/config";
import type { DomainEventRecord } from "@/modules/events/types";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("configuración", () => {
  it("sin variables: todo apagado y arranca", () => {
    expect(readMeasurementConfig(env({}))).toEqual({ meta: null, ga4: null, googleAdsId: null, clarityId: null });
  });

  it("completa: encendida, y al navegador solo llegan identificadores públicos", () => {
    const e = env({
      KORA_META_PIXEL_ID: "1234567890123456",
      KORA_META_CAPI_TOKEN: "secreto-meta",
      KORA_GA4_MEASUREMENT_ID: "G-ABC123XYZ",
      KORA_GA4_API_SECRET: "secreto-ga4",
      KORA_GOOGLE_ADS_ID: "AW-123456789",
    });
    expect(readMeasurementConfig(e).meta?.pixelId).toBe("1234567890123456");
    const pub = measurementPublicConfig(e);
    expect(pub).toEqual({
      metaPixelId: "1234567890123456",
      ga4Id: "G-ABC123XYZ",
      googleAdsId: "AW-123456789",
      clarityId: null,
    });
    expect(JSON.stringify(pub)).not.toContain("secreto");
  });

  it("Clarity sola enciende la medición (y el aviso); mal formada, no arranca", () => {
    expect(measurementPublicConfig(env({ KORA_CLARITY_ID: "yw7pkvsz32" })).clarityId).toBe("yw7pkvsz32");
    expect(() => readMeasurementConfig(env({ KORA_CLARITY_ID: "https://clarity.ms/x" }))).toThrow(/KORA_CLARITY_ID/);
  });

  it("a medias o mal formada: la app no arranca y dice qué falta", () => {
    const fallos = fallosDeArranque(env({ NODE_ENV: "development", KORA_META_PIXEL_ID: "1234567890123456" }));
    const medicion = fallos.find((f) => f.asunto === "Medición publicitaria");
    expect(medicion?.mensaje).toContain("KORA_META_CAPI_TOKEN");

    expect(() => readMeasurementConfig(env({ KORA_GA4_MEASUREMENT_ID: "UA-1", KORA_GA4_API_SECRET: "x" }))).toThrow(
      /G-XXXXXXX/,
    );
    expect(() => readMeasurementConfig(env({ KORA_GOOGLE_ADS_ID: "AW-123456789" }))).toThrow(/GA4/);
  });
});

describe("origen de la visita", () => {
  const url = (q: string) => new URL(`https://korashopp.com/producto/x${q}`);

  it("UTM: se toma tal cual", () => {
    const t = touchFromVisit(url("?utm_source=Meta&utm_medium=paid&utm_campaign=apertura-neiva"), null, 1);
    expect(t).toMatchObject({ source: "meta", medium: "paid", campaign: "apertura-neiva", landing: "/producto/x" });
  });

  it("clic de anuncio sin UTM: se infiere la plataforma", () => {
    expect(touchFromVisit(url("?fbclid=abc"), null)).toMatchObject({ source: "facebook", medium: "cpc", fbclid: "abc" });
    expect(touchFromVisit(url("?gclid=xyz"), null)).toMatchObject({ source: "google", medium: "cpc", gclid: "xyz" });
  });

  it("referente externo cuenta; navegación interna y entrada directa no", () => {
    expect(touchFromVisit(url(""), "https://www.instagram.com/")).toMatchObject({ source: "instagram.com", medium: "referral" });
    expect(touchFromVisit(url(""), "https://korashopp.com/catalogo")).toBeNull();
    expect(touchFromVisit(url(""), null)).toBeNull();
  });

  it("una visita directa NO borra el anuncio que trajo al comprador", () => {
    const anuncio = touchFromVisit(url("?utm_source=meta&utm_campaign=c1"), null, 1)!;
    expect(mergeTouch(anuncio, null)).toBe(anuncio);
    const otro = touchFromVisit(url("?utm_source=google&utm_campaign=c2"), null, 2)!;
    expect(mergeTouch(anuncio, otro)).toBe(otro);
  });

  it("la cookie se lee de vuelta, y basura es 'sin origen', no un error", () => {
    const t = touchFromVisit(url("?utm_source=meta"), null, 5)!;
    expect(parseTouch(serializeTouch(t))).toEqual(t);
    expect(parseTouch("no-es-json")).toBeNull();
    expect(parseTouch(JSON.stringify({ medium: "x" }))).toBeNull();
  });

  it("identificadores de plataforma", () => {
    expect(fbcFromFbclid("abc", 1700000000000)).toBe("fb.1.1700000000000.abc");
    expect(gaClientIdFromCookie("GA1.1.123456789.1700000000")).toBe("123456789.1700000000");
    expect(gaClientIdFromCookie("basura")).toBeNull();
    expect(gaSessionIdFromCookie("GS1.1.1700000000.3.1.1700000100.0.0.0")).toBe("1700000000");
    expect(gaSessionIdFromCookie("GS2.1.s1700000000$o3$g1$t1700000100")).toBe("1700000000");
  });
});

const PEDIDO: ConfirmedOrder = {
  id: "ord_1",
  number: 42,
  createdAt: new Date("2026-10-20T15:00:00Z"),
  confirmedAt: new Date("2026-10-20T18:00:00Z"),
  currency: "USD",
  total: 40,
  customerId: "cus_1",
  contactName: "  Ána María Pérez ",
  contactEmail: " Ana@Correo.COM ",
  contactPhone: "+1 (305) 555-0100",
  billCity: "Miami Beach",
  billState: "FL",
  billCountry: "US",
  billZip: "33139",
  items: [{ sku: "SKU-1", productName: "Perfume", qty: 2, unitPrice: 20 }],
  attribution: {
    fbp: "fb.1.1.1",
    fbc: null,
    gaClientId: "111.222",
    gaSessionId: "1700000000",
    userAgent: "UA",
    ipAddress: "1.2.3.4",
  },
};

describe("datos a las plataformas", () => {
  it("normaliza antes de cifrar: misma persona, misma huella", () => {
    expect(normEmail(" Ana@Correo.COM ")).toBe("ana@correo.com");
    expect(normPhone("+57 314 275 1611")).toBe("573142751611");
    expect(normPlace("Bogotá D.C.")).toBe("bogotadc");
    expect(splitName("  Ána María Pérez ")).toEqual({ fn: "ana", ln: "perez" });
  });

  it("Meta: compra con event_id estable, valor y moneda reales, datos cifrados", () => {
    const now = new Date("2026-10-20T19:00:00Z");
    const ev = buildMetaPurchase(PEDIDO, "https://korashopp.com/checkout", now);
    expect(ev.event_name).toBe("Purchase");
    expect(ev.event_id).toBe("order-ord_1");
    expect(ev.event_time).toBe(Math.floor(PEDIDO.confirmedAt!.getTime() / 1000));
    expect(ev.custom_data).toMatchObject({ currency: "USD", value: 40, num_items: 2 });
    expect(ev.user_data.em).toEqual([sha256("ana@correo.com")]);
    expect(ev.user_data.ph).toEqual([sha256("13055550100")]);
    expect(ev.user_data.ct).toEqual([sha256("miamibeach")]);
    expect(ev.user_data.country).toEqual([sha256("us")]);
    // Ningún dato personal viaja en claro.
    expect(JSON.stringify(ev)).not.toMatch(/ana@correo|Pérez|3055550100/i);
  });

  it("Meta: una confirmación de hace más de 7 días se informa con la hora actual", () => {
    const now = new Date(PEDIDO.confirmedAt!.getTime() + 8 * 86_400_000);
    expect(buildMetaPurchase(PEDIDO, "u", now).event_time).toBe(Math.floor(now.getTime() / 1000));
  });

  it("GA4: compra con el código del pedido y NINGÚN dato personal", () => {
    const p = buildGa4Purchase(PEDIDO, new Date("2026-10-20T19:00:00Z"));
    expect(p.client_id).toBe("111.222");
    expect(p.events[0].params).toMatchObject({ currency: "USD", value: 40, session_id: "1700000000" });
    expect(String(p.events[0].params.transaction_id)).toBe("KO-2026-00042");
    expect(JSON.stringify(p)).not.toMatch(/correo|3055550100|perez|1\.2\.3\.4/i);
  });
});

// ─────────────────────────────────────────────────────────────
// Manejadores del worker, contra la base.

const PREFIJO = "zzt-medicion";
const VARS = {
  KORA_META_PIXEL_ID: "1234567890123456",
  KORA_META_CAPI_TOKEN: "token",
  KORA_GA4_MEASUREMENT_ID: "G-TEST1234",
  KORA_GA4_API_SECRET: "secreto",
};

async function limpiar() {
  await db.order.deleteMany({ where: { note: PREFIJO } });
  await db.customer.deleteMany({ where: { name: PREFIJO } });
}

async function pedidoConfirmado(over: { channel?: "WEB" | "POS"; consent?: boolean } = {}) {
  const c = await db.customer.create({
    data: { name: PREFIJO, email: `${PREFIJO}-${Date.now()}-${Math.random()}@test.local` },
  });
  return db.order.create({
    data: {
      channel: over.channel ?? "WEB",
      status: "CONFIRMED",
      currency: "COP",
      customerId: c.id,
      subtotal: 85000,
      total: 85000,
      note: PREFIJO,
      contactEmail: c.email,
      contactName: "Ana Prueba",
      confirmedAt: new Date(),
      attribution: { create: { consent: over.consent ?? true, source: "meta", campaign: "c1" } },
    },
  });
}

function evento(orderId: string): DomainEventRecord {
  return { id: `ev-${orderId}`, type: "order.confirmed", payload: { orderId }, attempts: 0, createdAt: new Date() };
}

describe("compra confirmada → Meta y GA4", () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));

  beforeEach(async () => {
    await limpiar();
    Object.assign(process.env, VARS);
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(async () => {
    for (const k of Object.keys(VARS)) delete process.env[k];
    vi.unstubAllGlobals();
    await limpiar();
  });

  it("informa una sola vez por plataforma aunque el evento llegue dos veces", async () => {
    const o = await pedidoConfirmado();
    for (let i = 0; i < 2; i++) {
      await orderConfirmedMetaHandler.handle(evento(o.id));
      await orderConfirmedGa4Handler.handle(evento(o.id));
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const filas = await db.adConversion.findMany({ where: { orderId: o.id } });
    expect(filas.map((f) => f.platform).sort()).toEqual(["GA4", "META"]);
  });

  it("sin consentimiento o en el POS: no se informa y no falla", async () => {
    for (const o of [await pedidoConfirmado({ consent: false }), await pedidoConfirmado({ channel: "POS" })]) {
      await orderConfirmedMetaHandler.handle(evento(o.id));
      await orderConfirmedGa4Handler.handle(evento(o.id));
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si la plataforma falla, el manejador lanza (el worker reintenta) y no deja constancia", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { message: "caído" } }), { status: 500 }));
    const o = await pedidoConfirmado();
    await expect(orderConfirmedMetaHandler.handle(evento(o.id))).rejects.toThrow(/caído/);
    expect(await db.adConversion.count({ where: { orderId: o.id } })).toBe(0);
  });

  it("plataforma apagada: nada", async () => {
    for (const k of Object.keys(VARS)) delete process.env[k];
    const o = await pedidoConfirmado();
    await orderConfirmedMetaHandler.handle(evento(o.id));
    await orderConfirmedGa4Handler.handle(evento(o.id));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("política de privacidad", () => {
  it("sin medición conserva el texto aprobado; con medición describe análisis y publicidad sin nombrar proveedores", () => {
    for (const idioma of ["es", "en"] as const) {
      const sin = legalDocument("datos-personales", merchant(), idioma, { medicion: false });
      const con = legalDocument("datos-personales", merchant(), idioma, { medicion: true });
      const cookies = (d: typeof sin) => JSON.stringify(d.sections.find((s) => s.id === "cookies"));
      expect(cookies(sin)).not.toMatch(/análisis|analytics/i);
      expect(cookies(con)).toMatch(/análisis|analytics/i);
      expect(cookies(con)).toMatch(/cifrad|hashed/i);
      // Sin nombrar proveedores (decisión de Daniel, 11 oct).
      expect(cookies(con)).not.toMatch(/Meta|Google|Clarity/);
    }
  });
});

describe("política de cookies", () => {
  it("existe en los dos idiomas, dice que cerrar el aviso NO es aceptar, y no nombra proveedores", () => {
    for (const idioma of ["es", "en"] as const) {
      const d = legalDocument("cookies", merchant(), idioma);
      const texto = JSON.stringify(d);
      expect(texto).toMatch(idioma === "es" ? /solo usamos las cookies necesarias/i : /only use necessary cookies/i);
      expect(texto).not.toMatch(/Meta|Google|Clarity|Facebook/);
    }
  });
});

