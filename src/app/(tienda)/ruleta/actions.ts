"use server";

// Acciones de la ruleta de la apertura. Ver openspec/changes/ruleta-apertura.

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { generarClaveTemporal, registerBuyer } from "@/modules/buyer/account";
import { sendCuentaRapidaEmail } from "@/modules/buyer/cuenta-rapida-email";
import { currentBuyer, startBuyerSession } from "@/modules/buyer/session-cookie";
import { normalizarTelefono } from "@/modules/customers/phone";
import { getMessages } from "@/modules/i18n/server";
import { girar } from "@/modules/ruleta/ruleta";
import { celularColombiano, correoValido, sugerenciaCorreo } from "@/modules/ruleta/validacion";
import { resolveMx } from "node:dns/promises";

export type RegistroState = { error?: string; ok?: boolean; nombre?: string; entrar?: boolean } | null;

/**
 * Registro rápido desde la ruleta: SIN contraseña en el momento (Daniel, 17
 * oct). Se crea la cuenta con una contraseña temporal propia de esa persona,
 * le llega por correo, la sesión queda abierta para girar y, al primer acceso
 * con esa clave, la tienda le pide cambiarla.
 *
 * El celular es obligatorio —con él la caja encuentra el premio— y se revisa
 * ANTES de crear nada: si ya giró, crear la cuenta no le serviría.
 */
export async function registrarParaGirar(_prev: RegistroState, formData: FormData): Promise<RegistroState> {
  const { errores, ruleta } = await getMessages();
  if (formData.get("datos") !== "on") return { error: ruleta.errores.DATOS };

  const digitos = celularColombiano(String(formData.get("phone") ?? ""));
  const celular = digitos ? normalizarTelefono(`+57${digitos}`) : null;
  if (!celular) return { error: ruleta.errores.CELULAR_FORMATO };
  if (await db.ruletaGiro.findUnique({ where: { phone: celular }, select: { id: true } })) {
    return { error: ruleta.errores.CELULAR_USADO };
  }

  const escrito = String(formData.get("email") ?? "");
  const nombre = String(formData.get("name") ?? "").trim();
  if (nombre.length < 3) return { error: errores.nombreCompleto };
  const email = correoValido(escrito);
  if (!email) return { error: ruleta.errores.CORREO };
  const sugerido = sugerenciaCorreo(email);
  if (sugerido) return { error: ruleta.registro.quisoDecir(sugerido) };
  if (!(await dominioRecibeCorreo(email))) return { error: ruleta.errores.CORREO_DOMINIO };

  // Con cuenta ya creada no se le pone otra clave: entra con la suya.
  const existente = await db.customer.findUnique({ where: { email }, select: { passwordHash: true } });
  if (existente?.passwordHash) return { error: ruleta.errores.CORREO_CON_CUENTA, entrar: true };

  const clave = generarClaveTemporal();
  const r = await registerBuyer({ name: nombre, email, password: clave, phone: celular });
  if (!r.ok) return { error: errores.traducir(r.error) };
  if (!r.customerId) return { error: ruleta.errores.CORREO_CON_CUENTA, entrar: true };

  await db.customer.update({
    where: { id: r.customerId },
    data: {
      mustChangePassword: true,
      // Habeas Data: las promociones son un sí explícito y aparte.
      ...(formData.get("promos") === "on" ? { acceptsMarketing: true, unsubscribedAt: null } : {}),
    },
  });

  await sendCuentaRapidaEmail(email, nombre || null, clave).catch(() => false);

  const h = await headers();
  await startBuyerSession(r.customerId, h.get("user-agent") ?? undefined);
  return { ok: true, nombre: nombre.split(/\s+/)[0] };
}

/**
 * ¿El dominio del correo existe y recibe correo? Un "pepe@asdkjh.com" pasa
 * cualquier expresión regular y no sirve para nada. Si el DNS tarda o falla
 * por otra razón se deja pasar: nadie se queda sin girar por un problema de red.
 */
async function dominioRecibeCorreo(email: string): Promise<boolean> {
  const dominio = email.slice(email.lastIndexOf("@") + 1);
  try {
    const mx = await Promise.race([
      resolveMx(dominio),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    return mx === null || mx.length > 0;
  } catch (e) {
    const code = (e as { code?: string }).code;
    return !(code === "ENOTFOUND" || code === "ENODATA");
  }
}

export type GiroResultado =
  | { ok: true; premio: string; titulo: string; vence: string }
  | { ok: false; error: string; motivo: string };

export async function girarRuleta(celular?: string): Promise<GiroResultado> {
  const { ruleta } = await getMessages();
  const buyer = await currentBuyer();
  if (!buyer) return { ok: false, motivo: "SIN_SESION", error: ruleta.errores.SIN_SESION };

  const r = await girar(buyer.customerId, celular);
  if (!r.ok) return { ok: false, motivo: r.motivo, error: ruleta.errores[r.motivo] };
  return { ok: true, premio: r.premio, titulo: r.titulo, vence: r.vence.toISOString() };
}
