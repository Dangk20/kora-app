// La compra confirmada, tal como se informa a Meta y a GA4.
//
// Las cargas útiles se construyen con funciones PURAS (se prueban sin red) y
// se envían con `fetch` en funciones aparte. Ninguna de las dos lee la base:
// el manejador del worker les pasa el pedido ya cargado.

import { formatOrderNumber } from "@/modules/orders/message";
import {
  hashed,
  normCountry,
  normEmail,
  normPhone,
  normPlace,
  normZip,
  sha256,
  splitName,
} from "./hash";
import type { Ga4Config, MetaConfig } from "./config";

/** Versión de la Graph API. Meta retira versiones cada ~2 años: revisar al cambiar. */
export const META_GRAPH_VERSION = "v23.0";

export type ConfirmedOrder = {
  id: string;
  number: number;
  createdAt: Date;
  confirmedAt: Date | null;
  currency: "COP" | "USD";
  /** Total neto del pedido (después de cupón y cashback): lo que se cobró. */
  total: number;
  customerId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  billCity: string | null;
  billState: string | null;
  billCountry: string | null;
  billZip: string | null;
  items: { sku: string; productName: string; qty: number; unitPrice: number }[];
  attribution: {
    fbp: string | null;
    fbc: string | null;
    gaClientId: string | null;
    gaSessionId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  };
};

/** El `event_id` estable de la compra: lo que permite a Meta deduplicar. */
export function metaEventId(orderId: string): string {
  return `order-${orderId}`;
}

function sinNulos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

/** Un dato cifrado en el formato de lista que pide la API (`em: [hash]`). */
function lista(v: string | null): string[] | null {
  return v ? [v] : null;
}

export function buildMetaPurchase(order: ConfirmedOrder, sourceUrl: string, now: Date = new Date()) {
  const { fn, ln } = splitName(order.contactName);
  // `event_time` no puede ser futuro ni de hace más de 7 días. La confirmación
  // siempre es pasada; si un reintento llega más tarde, se manda la hora real.
  const when = order.confirmedAt ?? now;
  const edadMs = now.getTime() - when.getTime();
  const eventTime = Math.floor((edadMs > 6.5 * 86_400_000 ? now : when).getTime() / 1000);

  const user_data = sinNulos({
    em: lista(hashed(normEmail(order.contactEmail))),
    ph: lista(hashed(normPhone(order.contactPhone))),
    fn: lista(hashed(fn)),
    ln: lista(hashed(ln)),
    ct: lista(hashed(normPlace(order.billCity))),
    st: lista(hashed(normPlace(order.billState))),
    zp: lista(hashed(normZip(order.billZip))),
    country: lista(hashed(normCountry(order.billCountry))),
    external_id: lista(order.customerId ? sha256(order.customerId) : null),
    client_ip_address: order.attribution.ipAddress,
    client_user_agent: order.attribution.userAgent,
    fbp: order.attribution.fbp,
    fbc: order.attribution.fbc,
  });

  return {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: metaEventId(order.id),
    action_source: "website",
    event_source_url: sourceUrl,
    user_data,
    custom_data: {
      currency: order.currency,
      value: order.total,
      order_id: formatOrderNumber(order.number, order.createdAt),
      content_type: "product",
      contents: order.items.map((i) => ({ id: i.sku, quantity: i.qty, item_price: i.unitPrice })),
      num_items: order.items.reduce((n, i) => n + i.qty, 0),
    },
  };
}

export function buildGa4Purchase(order: ConfirmedOrder, now: Date = new Date()) {
  // Sin `_ga` (comprador que aceptó tarde, o bloqueador) GA4 igual cuenta la
  // compra; solo pierde con qué visita emparejarla. Un id estable por pedido
  // evita inventar usuarios distintos en cada reintento.
  const clientId = order.attribution.gaClientId ?? `kora.${order.id}`;
  const when = order.confirmedAt ?? now;
  // GA4 acepta eventos de hasta 72 h atrás.
  const edadMs = now.getTime() - when.getTime();
  const micros = (edadMs > 71 * 3_600_000 ? now : when).getTime() * 1000;

  return {
    client_id: clientId,
    timestamp_micros: micros,
    non_personalized_ads: false,
    events: [
      {
        name: "purchase",
        params: sinNulos({
          transaction_id: formatOrderNumber(order.number, order.createdAt),
          currency: order.currency,
          value: order.total,
          session_id: order.attribution.gaSessionId,
          engagement_time_msec: 1,
          items: order.items.map((i) => ({
            item_id: i.sku,
            item_name: i.productName,
            quantity: i.qty,
            price: i.unitPrice,
          })),
        }),
      },
    ],
  };
}

/** Error de un proveedor de medición. Lanzarlo hace que el worker reintente. */
export class MeasurementSendError extends Error {}

export async function sendMetaEvents(
  config: MetaConfig,
  events: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ eventsReceived: number }> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.pixelId}/events`;
  const body = sinNulos({
    data: events,
    access_token: config.capiToken,
    test_event_code: config.testEventCode,
  });
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    events_received?: number;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new MeasurementSendError(`Meta respondió ${res.status}: ${json.error?.message ?? "sin detalle"}`);
  }
  return { eventsReceived: json.events_received ?? 0 };
}

/**
 * Envía a GA4. Con `debug`, usa el validador (`/debug/mp/collect`), que NO
 * registra el evento y devuelve los errores de la carga útil: el endpoint real
 * responde 204 a todo, incluso a una carga inválida.
 */
export async function sendGa4(
  config: Ga4Config,
  payload: unknown,
  opciones: { debug?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<{ validationMessages: unknown[] }> {
  const ruta = opciones.debug ? "debug/mp/collect" : "mp/collect";
  const url =
    `https://www.google-analytics.com/${ruta}` +
    `?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;
  const res = await (opciones.fetchImpl ?? fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new MeasurementSendError(`GA4 respondió ${res.status}`);
  if (!opciones.debug) return { validationMessages: [] };
  const json = (await res.json().catch(() => ({}))) as { validationMessages?: unknown[] };
  return { validationMessages: json.validationMessages ?? [] };
}
