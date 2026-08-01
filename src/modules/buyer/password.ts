// Contraseña del comprador.
// Ver openspec/changes/cuenta-comprador — specs/buyer-authentication.

import bcrypt from "bcryptjs";

/** Mínimo exigido. Se dice ANTES de enviar el formulario, no después. */
export const MIN_PASSWORD = 8;

export const MENSAJE_PASSWORD = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return MENSAJE_PASSWORD;
  return null;
}

// Mismo coste que el panel: es el mismo compromiso entre resistencia a la
// fuerza bruta y latencia de un acceso.
const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Comparación de descarte cuando la cuenta no existe.
 *
 * Sin esto, un correo sin cuenta responde en un milisegundo y uno con cuenta
 * tarda lo que tarda bcrypt: la diferencia de tiempo delata quién es cliente,
 * que es justo lo que los mensajes iguales existen para ocultar.
 */
const HASH_SEÑUELO = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function quemarTiempo(password: string): Promise<void> {
  await bcrypt.compare(password, HASH_SEÑUELO);
}
