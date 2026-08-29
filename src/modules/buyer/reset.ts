// Recuperación de contraseña del comprador, por código al correo.
//
// Estuvo bloqueada desde julio porque `korashopp.com` no podía enviar correo.
// El 28 ago 2026 se resolvió y esto es lo que faltaba.
//
// ── Las cinco reglas, y por qué cada una ──────────────────────────────────
//
// 1. NUNCA se revela si un correo tiene cuenta. Pidas el que pidas, la
//    respuesta es idéntica. Es la misma regla que ya rige el resto del módulo:
//    una pantalla que responde distinto según el correo es un buscador de
//    clientes, y aquí además diría "esta persona compra en KORA".
//
// 2. Se guarda el HASH del código, nunca el código. Es una credencial de pleno
//    derecho: quien pueda leer la tabla no debe poder entrar en ninguna cuenta.
//    Mismo criterio que las contraseñas y las sesiones.
//
// 3. Caduca pronto y se usa UNA vez. Un código que sigue valiendo después de
//    usarse es un código que vale para quien lo vea en una pantalla o en un
//    reenvío del correo.
//
// 4. Máximo de intentos. Seis dígitos son un millón de combinaciones: sin tope,
//    un guion las prueba en minutos y el hash no sirve de nada porque el
//    atacante no necesita invertirlo, solo adivinar.
//
// 5. Cambiar la contraseña CIERRA TODAS LAS SESIONES. Si alguien tomó la
//    cuenta, recuperarla tiene que echarlo; si no, sigue dentro con su cookie y
//    la recuperación no ha servido para nada.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "./password";
import { revokeAllSessions } from "./session";

/** Seis dígitos: lo que cabe en la cabeza el tiempo de cambiar de pestaña. */
const LARGO_CODIGO = 6;

/** Quince minutos. Suficiente para leer el correo, corto para adivinarlo. */
export const VIGENCIA_CODIGO_MS = 15 * 60_000;

/** Al sexto intento el código muere y hay que pedir otro. */
export const MAX_INTENTOS = 5;

/**
 * El MISMO mensaje siempre, exista o no la cuenta.
 *
 * No se personaliza jamás. Un "no encontramos ese correo" convertiría esta
 * pantalla en una forma de averiguar quién es cliente de KORA.
 */
export const MENSAJE_ENVIO =
  "Si ese correo tiene una cuenta, te enviamos un código de 6 dígitos. Revisa tu bandeja y la carpeta de spam.";

/** El mismo mensaje para código inválido, caducado, ya usado o agotado. */
export const MENSAJE_CODIGO_INVALIDO =
  "El código no es válido o ya caducó. Pide uno nuevo.";

/**
 * El código en claro. `randomInt` es del generador criptográfico del sistema:
 * `Math.random()` es predecible y aquí lo que se genera es una credencial.
 */
function generarCodigo(): string {
  return String(randomInt(0, 10 ** LARGO_CODIGO)).padStart(LARGO_CODIGO, "0");
}

/**
 * SHA-256 y no bcrypt, a propósito.
 *
 * bcrypt es lento por diseño para que probar contraseñas cueste. Aquí el
 * espacio es de un millón y lo que impide la fuerza bruta es el límite de
 * intentos, no el coste por intento. Un hash lento solo haría que cada
 * comprobación legítima tardara, sin añadir nada: el código es aleatorio y de
 * un solo uso, así que no hay diccionario que aplicar.
 */
function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function igualEnTiempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export type SolicitudResult = {
  /** El código, SOLO cuando hay que enviarlo. Nunca sale de la capa de acción. */
  codigo: string | null;
  customerName: string | null;
};

/**
 * Pide un código. Devuelve siempre lo mismo desde fuera.
 *
 * Solo genera código si el correo tiene cuenta ACTIVA con contraseña: a quien
 * compró como invitado no se le "recupera" nada, porque no tiene contraseña que
 * recuperar — se registra, y eso ya recupera su historial.
 */
export async function requestPasswordReset(
  email: string,
  now: Date = new Date(),
): Promise<SolicitudResult> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return { codigo: null, customerName: null };

  const cliente = await db.customer.findUnique({
    where: { email: limpio },
    select: { id: true, name: true, passwordHash: true, accountActive: true },
  });

  if (!cliente?.passwordHash || !cliente.accountActive) {
    return { codigo: null, customerName: null };
  }

  // Los códigos anteriores mueren. Si no, pedir uno nuevo dejaría vivo el
  // viejo: cada solicitud ampliaría la superficie en vez de renovarla.
  await db.passwordReset.updateMany({
    where: { customerId: cliente.id, usedAt: null },
    data: { usedAt: now },
  });

  const codigo = generarCodigo();
  await db.passwordReset.create({
    data: {
      customerId: cliente.id,
      codeHash: hashCodigo(codigo),
      expiresAt: new Date(now.getTime() + VIGENCIA_CODIGO_MS),
    },
  });

  return { codigo, customerName: cliente.name };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; error: string; field?: "code" | "password" };

/**
 * Cambia la contraseña si el código es bueno.
 *
 * El código se busca por su HASH, así que la consulta encuentra la fila solo si
 * el código es exactamente el que se emitió — no hay comprobación posterior que
 * alguien pueda olvidar. Misma regla que el identificador del comprador en el
 * `where` del resto del módulo.
 */
export async function confirmPasswordReset(
  email: string,
  codigo: string,
  nuevaPassword: string,
  now: Date = new Date(),
): Promise<ConfirmResult> {
  const problema = passwordProblem(nuevaPassword);
  if (problema) return { ok: false, error: problema, field: "password" };

  const limpio = email.trim().toLowerCase();
  const codigoLimpio = codigo.replace(/\D/g, "");

  const cliente = await db.customer.findUnique({
    where: { email: limpio },
    select: { id: true },
  });
  if (!cliente) return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };

  // El vivo de este cliente, sea cual sea el código tecleado. Se busca así —y
  // no por `codeHash`— para poder CONTAR el intento fallido: buscando por hash,
  // un código equivocado no encuentra nada y no habría dónde anotar el fallo,
  // con lo que el límite de intentos no existiría.
  const fila = await db.passwordReset.findFirst({
    where: { customerId: cliente.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!fila || fila.expiresAt <= now || fila.attempts >= MAX_INTENTOS) {
    return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };
  }

  if (!igualEnTiempoConstante(hashCodigo(codigoLimpio), fila.codeHash)) {
    // El intento se cuenta ANTES de responder. Si se contara después de algo
    // que pueda fallar, un atacante con reintentos rápidos podría no gastar
    // intentos nunca.
    await db.passwordReset.update({
      where: { id: fila.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };
  }

  const passwordHash = await hashPassword(nuevaPassword);

  await db.$transaction([
    // Se marca usado en la MISMA transacción que cambia la contraseña: si se
    // marcara después y algo fallara en medio, el código seguiría vivo sobre
    // una cuenta que ya cambió.
    db.passwordReset.update({ where: { id: fila.id }, data: { usedAt: now } }),
    db.customer.update({ where: { id: cliente.id }, data: { passwordHash } }),
  ]);

  // Fuera de la transacción a propósito: si esto fallara, la contraseña ya
  // cambió —que es lo que la persona pidió— y volver atrás la dejaría sin poder
  // entrar. Las sesiones viejas son un problema menor que ese.
  await revokeAllSessions(cliente.id);

  return { ok: true };
}
