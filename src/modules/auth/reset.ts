// Recuperación de contraseña de un usuario del PANEL, por código al correo.
//
// Hasta el 13 sep 2026 la pantalla decía "contacta al administrador" — y si
// quien la olvidó ERA el administrador, la única salida era `pnpm admin:create`
// por SSH. Esto es el mismo mecanismo del comprador (`buyer/reset.ts`), con
// las mismas cinco reglas, y dos diferencias porque esta cuenta ve y modifica
// el negocio entero:
//
//   · Cambiar la contraseña marca `passwordChangedAt`, y `checkPermission`
//     —que ya va a la base en cada acción— rechaza los JWT emitidos antes.
//     Así "cierra todas las sesiones" es verdad aunque el token dure 12 h.
//   · Solo usuarios ACTIVOS: a uno desactivado no se le recupera nada.
//
// Aparte del de compradores a propósito: las dos identidades no comparten
// mecanismo por diseño (ver `modules/buyer/README`).

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  MAX_INTENTOS,
  MENSAJE_CODIGO_INVALIDO,
  VIGENCIA_CODIGO_MS,
  generarCodigo,
  hashCodigo,
  igualEnTiempoConstante,
} from "@/modules/buyer/reset";

export { MENSAJE_ENVIO, MENSAJE_CODIGO_INVALIDO } from "@/modules/buyer/reset";

/** Mínimo del panel: es la contraseña de quien administra el negocio. */
export const LARGO_MINIMO_ADMIN = 12;

export async function requestUserPasswordReset(
  email: string,
  now: Date = new Date(),
): Promise<{ codigo: string | null; name: string | null }> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return { codigo: null, name: null };

  const user = await db.user.findUnique({
    where: { email: limpio },
    select: { id: true, name: true, active: true },
  });
  if (!user?.active) return { codigo: null, name: null };

  await db.userPasswordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });
  const codigo = generarCodigo();
  await db.userPasswordReset.create({
    data: { userId: user.id, codeHash: hashCodigo(codigo), expiresAt: new Date(now.getTime() + VIGENCIA_CODIGO_MS) },
  });
  return { codigo, name: user.name };
}

export type ConfirmResult = { ok: true } | { ok: false; error: string; field?: "code" | "password" };

export async function confirmUserPasswordReset(
  email: string,
  codigo: string,
  nuevaPassword: string,
  now: Date = new Date(),
): Promise<ConfirmResult> {
  if (nuevaPassword.length < LARGO_MINIMO_ADMIN) {
    return { ok: false, error: `Mínimo ${LARGO_MINIMO_ADMIN} caracteres: esta cuenta administra el negocio.`, field: "password" };
  }
  const limpio = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: limpio }, select: { id: true, active: true } });
  if (!user?.active) return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };

  const fila = await db.userPasswordReset.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!fila || fila.expiresAt <= now || fila.attempts >= MAX_INTENTOS) {
    return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };
  }
  if (!igualEnTiempoConstante(hashCodigo(codigo.replace(/\D/g, "")), fila.codeHash)) {
    await db.userPasswordReset.update({ where: { id: fila.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: MENSAJE_CODIGO_INVALIDO, field: "code" };
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 10);
  await db.$transaction([
    db.userPasswordReset.update({ where: { id: fila.id }, data: { usedAt: now } }),
    // `passwordChangedAt` es lo que invalida las sesiones abiertas.
    db.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now } }),
  ]);
  return { ok: true };
}
