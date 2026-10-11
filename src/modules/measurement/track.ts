// Eventos de navegación hacia el píxel de Meta y gtag. Solo navegador.
//
// Cada función es inofensiva si las etiquetas no cargaron (sin consentimiento,
// plataforma apagada, bloqueador): no hay `fbq` ni `gtag` en `window` y no pasa
// nada. Por eso los componentes las llaman sin preguntar.
//
// La COMPRA no está aquí, a propósito: la informa el servidor al confirmar el
// pedido (ver `events/handlers/order-confirmed-measurement.ts`).

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
  }
}

export type TrackItem = { sku: string; name: string; price: number; qty: number };

/**
 * Ejecuta `fn` cuando la etiqueta exista. En la PRIMERA página de la visita las
 * etiquetas cargan después de hidratar (`afterInteractive`), y el efecto de la
 * ficha corre antes: sin esta espera, el `ViewContent` de quien llega desde un
 * anuncio directo a un producto —el caso más común— se perdería. Solo espera si
 * hubo consentimiento; si no, no hay nada que esperar.
 */
function cuandoExista(clave: "fbq" | "gtag", fn: (f: Fbq) => void, intentos = 16): void {
  if (typeof window === "undefined") return;
  const f = window[clave];
  if (typeof f === "function") return fn(f);
  if (intentos <= 0 || !document.cookie.includes("kora_consentimiento=si")) return;
  setTimeout(() => cuandoExista(clave, fn, intentos - 1), 250);
}

function fbq(...args: unknown[]): void {
  cuandoExista("fbq", (f) => f(...args));
}

function gtag(...args: unknown[]): void {
  cuandoExista("gtag", (f) => f(...args));
}

function total(items: TrackItem[]): number {
  return Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
}

function gaItems(items: TrackItem[]) {
  return items.map((i) => ({ item_id: i.sku, item_name: i.name, price: i.price, quantity: i.qty }));
}

export function trackPageView(): void {
  fbq("track", "PageView");
}

export function trackViewContent(item: TrackItem, currency: string): void {
  fbq("track", "ViewContent", {
    content_ids: [item.sku],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency,
  });
  gtag("event", "view_item", { currency, value: item.price, items: gaItems([item]) });
}

export function trackAddToCart(item: TrackItem, currency: string): void {
  const value = total([item]);
  fbq("track", "AddToCart", {
    content_ids: [item.sku],
    content_name: item.name,
    content_type: "product",
    contents: [{ id: item.sku, quantity: item.qty }],
    value,
    currency,
  });
  gtag("event", "add_to_cart", { currency, value, items: gaItems([item]) });
}

export function trackInitiateCheckout(items: TrackItem[], currency: string): void {
  const value = total(items);
  fbq("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.sku),
    contents: items.map((i) => ({ id: i.sku, quantity: i.qty })),
    num_items: items.reduce((n, i) => n + i.qty, 0),
    value,
    currency,
  });
  gtag("event", "begin_checkout", { currency, value, items: gaItems(items) });
}

/** Pedido creado: intención fuerte, todavía no venta. */
export function trackLead(orderNumber: string, value: number, currency: string): void {
  fbq("track", "Lead", { value, currency, content_name: orderNumber }, { eventID: `lead-${orderNumber}` });
  gtag("event", "generate_lead", { currency, value, transaction_id: orderNumber });
}
