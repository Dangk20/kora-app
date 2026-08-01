// El enlace de baja: firmado, no almacenado.
// Ver openspec/changes/email-marketing — specs/email-consent.
//
// Si el enlace fuera el identificador del cliente, cualquiera podría recorrer
// identificadores y dar de baja a toda la base — un ataque silencioso que solo
// se notaría cuando las campañas dejaran de llegar a nadie. Firmarlo lo hace
// infalsificable sin guardar nada extra.
//
// SIN CADUCIDAD, a propósito: un enlace de baja que expira es un enlace de baja
// roto, y quien lo encuentre roto se queja en vez de darse de baja. Una queja
// de spam pesa mucho más que una baja: la registra el proveedor de correo del
// destinatario y afecta a todos los envíos futuros del dominio.

import { createHmac, timingSafeEqual } from "node:crypto";
import { storeUrl } from "@/modules/email/driver";

/**
 * El secreto de firma. Reusa el de la sesión del panel porque es el secreto
 * del despliegue: uno más sería una variable más que olvidar en producción, y
 * el alcance de este token es estrictamente menor que el de una sesión.
 */
function secreto(env = process.env): string {
  const s = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  if (s) return s;
  if (env.NODE_ENV === "production") {
    throw new Error("Falta AUTH_SECRET: no se pueden firmar los enlaces de baja.");
  }
  return "kora-dev-unsubscribe-secret";
}

function firma(customerId: string, env = process.env): string {
  return createHmac("sha256", secreto(env)).update(customerId).digest("base64url").slice(0, 32);
}

/** El token que viaja en el enlace: identificador + firma. */
export function unsubscribeToken(customerId: string, env = process.env): string {
  return `${customerId}.${firma(customerId, env)}`;
}

/**
 * Devuelve el cliente si el token es legítimo, o null.
 *
 * La comparación es en tiempo constante: una comparación normal filtra, por el
 * tiempo que tarda en fallar, cuántos caracteres del principio acertó quien lo
 * intenta — y con eso se puede reconstruir una firma byte a byte.
 */
export function verifyUnsubscribeToken(token: string, env = process.env): string | null {
  const corte = token.lastIndexOf(".");
  if (corte <= 0) return null;

  const customerId = token.slice(0, corte);
  const recibida = token.slice(corte + 1);
  const esperada = firma(customerId, env);

  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? customerId : null;
}

/** El enlace completo que va en el pie del correo. */
export function unsubscribeUrl(customerId: string, env = process.env): string {
  return `${storeUrl(env)}/suscripcion/baja?t=${encodeURIComponent(unsubscribeToken(customerId, env))}`;
}
