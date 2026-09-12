// Verificación de la firma de los webhooks del proveedor.
// Ver openspec/changes/consumo-y-metricas-de-correo — specs/email-provider-events.
//
// Resend firma con el esquema de Svix: HMAC-SHA256 sobre `id.timestamp.cuerpo`
// con la clave que va después de `whsec_`, en base64, y puede mandar varias
// firmas (`v1,abc v1,def`) durante una rotación de secreto. Se comprueba a mano
// —son 30 líneas— en vez de añadir su librería: una dependencia menos con
// acceso a la base, y un contrato que se lee entero.
//
// Este archivo NO importa nada de Next ni de la base: es puro, para probarlo
// sin levantar nada.

import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SECRET_VAR = "RESEND_WEBHOOK_SECRET";

/** Cinco minutos: lo que Svix recomienda. Más, y una petición capturada se reproduce. */
export const TOLERANCIA_MS = 5 * 60 * 1000;

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: "sin-secreto" | "cabeceras" | "timestamp" | "firma" };

export function webhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env[WEBHOOK_SECRET_VAR]?.trim();
  return v ? v : null;
}

function claveDesdeSecreto(secret: string): Buffer {
  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(b64, "base64");
}

export function firmar(secret: string, id: string, timestamp: string, body: string): string {
  return createHmac("sha256", claveDesdeSecreto(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

export function verifyWebhook(
  args: {
    secret: string | null;
    id: string | null;
    timestamp: string | null;
    signature: string | null;
    body: string;
  },
  now = Date.now(),
): VerificationResult {
  if (!args.secret) return { ok: false, reason: "sin-secreto" };
  if (!args.id || !args.timestamp || !args.signature) return { ok: false, reason: "cabeceras" };

  const ts = Number(args.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > TOLERANCIA_MS) {
    return { ok: false, reason: "timestamp" };
  }

  const esperada = Buffer.from(firmar(args.secret, args.id, args.timestamp, args.body));
  const candidatas = args.signature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => Buffer.from(s.slice(3)));

  // Comparación en tiempo constante, y contra CADA firma: durante una
  // rotación el proveedor manda la vieja y la nueva.
  const valida = candidatas.some(
    (c) => c.length === esperada.length && timingSafeEqual(c, esperada),
  );
  return valida ? { ok: true } : { ok: false, reason: "firma" };
}
