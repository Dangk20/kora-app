// Sesión del comprador. DELIBERADAMENTE no es Auth.js.
// Ver openspec/changes/cuenta-comprador — design.md §1.
//
// Dos garantías:
//   1. La credencial del comprador vive en su PROPIA cookie y se verifica por
//      su propio camino. La del panel es de Auth.js. Presentar una donde se
//      espera la otra no autentica — así, una ruta nueva del panel es segura
//      por omisión y no por acordarse de comprobar una marca en un token.
//   2. La sesión se verifica CONTRA LA BASE en cada petición, así que cerrarla
//      surte efecto ya. Un JWT no se puede retirar, y detrás de esta cuenta
//      hay saldo gastable.
//
// El mecanismo (emitir, resolver, revocar) está separado del transporte (la
// cookie) a propósito: así se puede probar sin fabricar una petición, y probar
// esto no es opcional.

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/** Vigencia de la sesión: 30 días, con renovación al usarla. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Se renueva como mucho una vez al día: no una escritura por petición. */
const RENOVAR_TRAS_MS = 24 * 60 * 60 * 1000;

/**
 * Lo que se guarda es el HASH del identificador, nunca el identificador.
 * Quien pueda leer la tabla de sesiones no puede suplantar a nadie con lo que
 * ve — mismo criterio que las contraseñas, y por el mismo motivo.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type BuyerSessionUser = {
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
};

// ── Mecanismo: sin cookies, probable ──────────────────────────

export type IssuedSession = { token: string; expiresAt: Date };

export async function issueSession(
  customerId: string,
  userAgent?: string,
  now: Date = new Date(),
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.buyerSession.create({
    data: { tokenHash: hashToken(token), customerId, expiresAt, userAgent: userAgent ?? null },
  });
  return { token, expiresAt };
}

/**
 * Quién está dentro, o null.
 *
 * Verifica contra la base: una cuenta desactivada o una sesión revocada dejan
 * de autenticar en la petición siguiente, no cuando caduque un token.
 */
export async function resolveSession(
  token: string | undefined,
  now: Date = new Date(),
): Promise<BuyerSessionUser | null> {
  if (!token) return null;

  const sesion = await db.buyerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true, accountActive: true },
      },
    },
  });

  if (!sesion) return null;
  if (sesion.expiresAt <= now) return null;
  if (!sesion.customer.accountActive) return null;

  // Renovación perezosa: alarga la sesión de quien la usa sin escribir en cada
  // petición. Una lectura por clave única es barata; una escritura no.
  if (now.getTime() - sesion.lastSeenAt.getTime() > RENOVAR_TRAS_MS) {
    await db.buyerSession.update({
      where: { id: sesion.id },
      data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    });
  }

  return {
    customerId: sesion.customer.id,
    name: sesion.customer.name,
    email: sesion.customer.email,
    phone: sesion.customer.phone,
  };
}

export async function revokeSession(token: string): Promise<void> {
  await db.buyerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Cierra TODAS las sesiones de un comprador, salvo la indicada.
 *
 * Es lo que hace falta al cambiar la contraseña: quien la cambia sospecha que
 * otra persona entró, y si las sesiones abiertas siguieran valiendo el gesto no
 * serviría de nada.
 */
export async function revokeAllSessions(
  customerId: string,
  exceptToken?: string,
): Promise<number> {
  const r = await db.buyerSession.deleteMany({
    where: {
      customerId,
      ...(exceptToken ? { tokenHash: { not: hashToken(exceptToken) } } : {}),
    },
  });
  return r.count;
}

/** Barrido de sesiones caducadas. Lo llama el trabajo programado. */
export async function pruneExpiredSessions(now: Date = new Date()): Promise<number> {
  const r = await db.buyerSession.deleteMany({ where: { expiresAt: { lte: now } } });
  return r.count;
}
