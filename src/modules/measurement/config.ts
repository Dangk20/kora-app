// Configuración de la medición publicitaria (change `medicion-publicitaria`).
//
// Cada plataforma está en uno de TRES estados, y el tercero es el que importa:
//   - apagada: ninguna variable definida → no hay etiquetas, ni banner, ni envíos;
//   - encendida: todas las obligatorias definidas y bien formadas;
//   - a medias: la aplicación NO arranca.
//
// "A medias" no se tolera por la misma razón que en almacenamiento y correo: un
// píxel sin su token de servidor carga en el navegador, cuenta visitas y nunca
// recibe una sola venta. Las campañas optimizarían contra cero compras y nada
// daría error en ninguna pantalla.
//
// Las variables se leen AL EJECUTARSE, nunca como `NEXT_PUBLIC_*`: la imagen se
// compila una vez para pruebas y producción, y un identificador grabado en el
// build mandaría los eventos de pruebas a la cuenta real.

export type MetaConfig = {
  pixelId: string;
  capiToken: string;
  /** Código de "Eventos de prueba" del Administrador de eventos. Solo en pruebas. */
  testEventCode: string | null;
};

export type Ga4Config = {
  measurementId: string;
  apiSecret: string;
};

export type MeasurementConfig = {
  meta: MetaConfig | null;
  ga4: Ga4Config | null;
  /** Etiqueta de Google Ads para remarketing. Solo con GA4 encendido. */
  googleAdsId: string | null;
  /** Proyecto de Microsoft Clarity (grabaciones y mapas de calor). Solo navegador. */
  clarityId: string | null;
};

/** Lo que el navegador necesita saber. NUNCA incluye secretos. */
export type MeasurementPublicConfig = {
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  clarityId: string | null;
};

const PIXEL_ID = /^\d{10,20}$/;
const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
const ADS_ID = /^AW-\d{6,15}$/;
const CLARITY_ID = /^[a-z0-9]{6,20}$/;

function valor(env: NodeJS.ProcessEnv, nombre: string): string | null {
  const v = env[nombre]?.trim();
  return v ? v : null;
}

/**
 * Lee la configuración y la valida entera. Lanza con TODOS los problemas
 * encontrados, no el primero: son insumos que hay que pedir afuera.
 */
export function readMeasurementConfig(env: NodeJS.ProcessEnv = process.env): MeasurementConfig {
  const problemas: string[] = [];

  // ── Meta ──
  const pixelId = valor(env, "KORA_META_PIXEL_ID");
  const capiToken = valor(env, "KORA_META_CAPI_TOKEN");
  const testEventCode = valor(env, "KORA_META_TEST_EVENT_CODE");
  let meta: MetaConfig | null = null;
  if (pixelId || capiToken) {
    if (!pixelId) problemas.push("Falta KORA_META_PIXEL_ID (el token de Meta está definido).");
    if (!capiToken) problemas.push("Falta KORA_META_CAPI_TOKEN (el píxel de Meta está definido).");
    if (pixelId && !PIXEL_ID.test(pixelId)) {
      problemas.push(`KORA_META_PIXEL_ID debe ser solo dígitos (llegó "${pixelId}").`);
    }
    if (pixelId && capiToken && PIXEL_ID.test(pixelId)) {
      meta = { pixelId, capiToken, testEventCode };
    }
  } else if (testEventCode) {
    problemas.push("KORA_META_TEST_EVENT_CODE está definido pero Meta no está configurado.");
  }

  // ── GA4 ──
  const measurementId = valor(env, "KORA_GA4_MEASUREMENT_ID");
  const apiSecret = valor(env, "KORA_GA4_API_SECRET");
  let ga4: Ga4Config | null = null;
  if (measurementId || apiSecret) {
    if (!measurementId) problemas.push("Falta KORA_GA4_MEASUREMENT_ID (el secreto de GA4 está definido).");
    if (!apiSecret) problemas.push("Falta KORA_GA4_API_SECRET (el ID de medición de GA4 está definido).");
    if (measurementId && !GA4_ID.test(measurementId)) {
      problemas.push(`KORA_GA4_MEASUREMENT_ID debe tener la forma G-XXXXXXX (llegó "${measurementId}").`);
    }
    if (measurementId && apiSecret && GA4_ID.test(measurementId)) {
      ga4 = { measurementId, apiSecret };
    }
  }

  // ── Google Ads ──
  const googleAdsId = valor(env, "KORA_GOOGLE_ADS_ID");
  if (googleAdsId) {
    if (!ADS_ID.test(googleAdsId)) {
      problemas.push(`KORA_GOOGLE_ADS_ID debe tener la forma AW-123456789 (llegó "${googleAdsId}").`);
    }
    // Las compras llegan a Google Ads importadas desde GA4: sin GA4, la
    // etiqueta de Ads cargaría sin ninguna conversión detrás.
    if (!measurementId) {
      problemas.push("KORA_GOOGLE_ADS_ID necesita GA4 configurado: las compras se importan desde GA4.");
    }
  }

  // ── Microsoft Clarity ──
  // Solo navegador, sin secreto: graba sesiones y arma mapas de calor. Por eso
  // también va detrás del consentimiento — una grabación de sesión es la
  // medición más invasiva de todas.
  const clarityId = valor(env, "KORA_CLARITY_ID");
  if (clarityId && !CLARITY_ID.test(clarityId)) {
    problemas.push(`KORA_CLARITY_ID debe ser el ID del proyecto de Clarity, en minúsculas (llegó "${clarityId}").`);
  }

  if (problemas.length > 0) {
    throw new Error(`Medición publicitaria mal configurada:\n       - ${problemas.join("\n       - ")}`);
  }

  return { meta, ga4, googleAdsId, clarityId };
}

/** Guarda de arranque. Ver `src/lib/startup-guards.ts`. */
export function assertMeasurementConfigured(env: NodeJS.ProcessEnv = process.env): void {
  readMeasurementConfig(env);
}

/** ¿Hay alguna plataforma encendida? Gobierna el banner y la política de cookies. */
export function medicionActiva(env: NodeJS.ProcessEnv = process.env): boolean {
  const c = readMeasurementConfig(env);
  return Boolean(c.meta || c.ga4 || c.clarityId);
}

/** Configuración apta para el navegador: identificadores públicos, nunca secretos. */
export function measurementPublicConfig(env: NodeJS.ProcessEnv = process.env): MeasurementPublicConfig {
  const c = readMeasurementConfig(env);
  return {
    metaPixelId: c.meta?.pixelId ?? null,
    ga4Id: c.ga4?.measurementId ?? null,
    googleAdsId: c.ga4 ? c.googleAdsId : null,
    clarityId: c.clarityId,
  };
}
