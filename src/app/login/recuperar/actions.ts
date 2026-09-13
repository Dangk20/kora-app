"use server";

// Recuperación de contraseña del PANEL. Mismo contrato y mismas reglas que
// las acciones del comprador (`(tienda)/cuenta/actions.ts`): respuesta
// idéntica exista o no la cuenta, límite de intentos por IP, y no inicia
// sesión sola — quien recupera entra tecleando la contraseña nueva.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ipDeConfianza } from "@/modules/geo/ip";
import {
  LARGO_MINIMO_ADMIN,
  MENSAJE_ENVIO,
  confirmUserPasswordReset,
  requestUserPasswordReset,
} from "@/modules/auth/reset";
import { comprobarLimite, limpiarIntentos, registrarFallo } from "@/modules/buyer/rate-limit";
import { sendResetCode } from "@/modules/buyer/reset-email";

export type FormState = { error?: string; ok?: boolean } | null;

async function origen(): Promise<string> {
  return `panel:${ipDeConfianza(await headers()) ?? "desconocido"}`;
}

export async function pedirCodigoPanel(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await origen();
  const limite = comprobarLimite(ip);
  if (!limite.permitido) {
    const min = Math.ceil(limite.esperaSegundos / 60);
    return { error: `Demasiados intentos. Espera ${min} minuto(s) y vuelve a probar.` };
  }
  const email = String(formData.get("email") ?? "");
  const { codigo, name } = await requestUserPasswordReset(email);
  if (codigo) {
    await sendResetCode(email.trim().toLowerCase(), codigo, name).catch(() => false);
  } else {
    registrarFallo(ip);
  }
  return { ok: true, error: MENSAJE_ENVIO };
}

export async function confirmarCodigoPanel(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await origen();
  const limite = comprobarLimite(ip);
  if (!limite.permitido) {
    const min = Math.ceil(limite.esperaSegundos / 60);
    return { error: `Demasiados intentos. Espera ${min} minuto(s) y vuelve a probar.` };
  }
  const r = await confirmUserPasswordReset(
    String(formData.get("email") ?? ""),
    String(formData.get("code") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!r.ok) {
    registrarFallo(ip);
    return { error: r.error };
  }
  limpiarIntentos(ip);
  redirect("/login?recuperada=1");
}
