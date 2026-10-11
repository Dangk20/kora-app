// Origen de una visita y regla de qué origen se queda. PURO: no importa nada
// de Next ni de la base, porque lo usan el navegador (al escribir la cookie) y
// el servidor (al leerla en el checkout).
//
// Regla: ÚLTIMO TOQUE NO DIRECTO. Quien llega por un anuncio, se va y vuelve
// tecleando la dirección compró gracias al anuncio; si la visita directa
// borrara el origen, toda venta de un comprador que lo pensó dos días se
// contaría como "directo" y el anuncio que la trajo parecería no vender.

export const COOKIE_ORIGEN = "kora_origen";
export const COOKIE_CONSENTIMIENTO = "kora_consentimiento";

/** Días que dura el origen. Coincide con la ventana de atribución típica de Meta. */
export const DIAS_ORIGEN = 30;
export const DIAS_CONSENTIMIENTO = 180;

const MAX = 150;

export type Touch = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  fbclid: string | null;
  gclid: string | null;
  /** Ruta de entrada, sin dominio. */
  landing: string | null;
  /** Momento de la visita, en milisegundos. */
  at: number;
};

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t.slice(0, MAX) : null;
}

/**
 * El origen de UNA visita a partir de su URL y su referente.
 *
 * Devuelve `null` si la visita no trae origen identificable: entrada directa,
 * o navegación desde la propia tienda. Ese `null` es lo que impide que pise un
 * origen guardado.
 */
export function touchFromVisit(
  url: URL,
  referrer: string | null,
  now: number = Date.now(),
): Touch | null {
  const p = url.searchParams;
  const fbclid = limpio(p.get("fbclid"));
  const gclid = limpio(p.get("gclid")) ?? limpio(p.get("gbraid")) ?? limpio(p.get("wbraid"));
  let source = limpio(p.get("utm_source"))?.toLowerCase() ?? null;
  let medium = limpio(p.get("utm_medium"))?.toLowerCase() ?? null;

  // Un clic de anuncio sin UTM sigue siendo un anuncio.
  if (!source && fbclid) source = "facebook";
  if (!source && gclid) source = "google";
  if (!medium && (fbclid || gclid) && !p.get("utm_source")) medium = "cpc";

  // Sin parámetros, un referente EXTERNO también es origen (orgánico o social).
  if (!source && referrer) {
    try {
      const ref = new URL(referrer);
      if (ref.hostname && ref.hostname !== url.hostname) {
        source = ref.hostname.replace(/^www\./, "").slice(0, MAX);
        medium = "referral";
      }
    } catch {
      // Referente ilegible: se ignora.
    }
  }

  if (!source) return null;

  return {
    source,
    medium,
    campaign: limpio(p.get("utm_campaign")),
    content: limpio(p.get("utm_content")),
    term: limpio(p.get("utm_term")),
    fbclid,
    gclid,
    landing: limpio(url.pathname),
    at: now,
  };
}

/** Lo que queda guardado tras una visita. */
export function mergeTouch(guardado: Touch | null, visita: Touch | null): Touch | null {
  return visita ?? guardado;
}

export function serializeTouch(t: Touch): string {
  return JSON.stringify(t);
}

/** Lee la cookie. Cualquier cosa malformada es "sin origen", nunca un error. */
export function parseTouch(raw: string | null | undefined): Touch | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? limpio(o[k] as string) : null);
    const source = s("source");
    if (!source) return null;
    return {
      source,
      medium: s("medium"),
      campaign: s("campaign"),
      content: s("content"),
      term: s("term"),
      fbclid: s("fbclid"),
      gclid: s("gclid"),
      landing: s("landing"),
      at: typeof o.at === "number" && Number.isFinite(o.at) ? o.at : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * `_fbc` en el formato documentado por Meta (`fb.1.<ms>.<fbclid>`). El píxel
 * la escribe solo cuando carga en la página que trae el `fbclid`; si el
 * comprador aceptó las cookies DESPUÉS de esa página, no existe, y se deriva
 * del clic que guardó el origen.
 */
export function fbcFromFbclid(fbclid: string, at: number): string {
  return `fb.1.${at}.${fbclid}`;
}

/** `GA1.1.123456789.1700000000` → `123456789.1700000000`. */
export function gaClientIdFromCookie(raw: string | null | undefined): string | null {
  const m = raw?.match(/^GA\d\.\d\.(\d+\.\d+)$/);
  return m ? m[1] : null;
}

/**
 * Identificador de sesión de GA4 desde la cookie `_ga_<id>`. Hay dos formatos
 * vivos: `GS1.1.1700000000.3.1…` y `GS2.1.s1700000000$o3$g1…`.
 */
export function gaSessionIdFromCookie(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v2 = raw.match(/^GS2\.\d\.s(\d+)/);
  if (v2) return v2[1];
  const v1 = raw.match(/^GS1\.\d\.(\d+)\./);
  return v1 ? v1[1] : null;
}

/** Nombre de la cookie de sesión de GA4 para un ID de medición. */
export function gaSessionCookieName(measurementId: string): string {
  return `_ga_${measurementId.replace(/^G-/, "")}`;
}
