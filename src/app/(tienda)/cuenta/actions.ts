"use server";

// Acciones de la cuenta del comprador.
// Ver openspec/changes/cuenta-comprador — specs/buyer-authentication.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  MENSAJE_ACCESO,
  changePassword,
  registerBuyer,
  verifyBuyer,
} from "@/modules/buyer/account";
import { comprobarLimite, limpiarIntentos, registrarFallo } from "@/modules/buyer/rate-limit";
import { revokeAllSessions } from "@/modules/buyer/session";
import {
  currentBuyerToken,
  endBuyerSession,
  startBuyerSession,
} from "@/modules/buyer/session-cookie";
import { requireBuyer } from "@/modules/buyer/guard";

export type FormState = { error?: string; ok?: boolean } | null;

/** El origen que se limita. Detrás de un proxy, la cabecera reenviada. */
async function origen(): Promise<string> {
  const h = await headers();
  const reenviado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviado || h.get("x-real-ip") || "desconocido";
}

/** Solo destinos internos: un "volver" abierto es una redirección abusable. */
function destinoSeguro(volver: unknown): string {
  const v = typeof volver === "string" ? volver : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/cuenta";
}

export async function entrar(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await origen();
  const limite = comprobarLimite(ip);
  if (!limite.permitido) {
    // No se dice si el correo existe ni cuántos intentos van: solo que espere.
    const min = Math.ceil(limite.esperaSegundos / 60);
    return { error: `Demasiados intentos. Vuelve a intentarlo en ${min} minuto${min === 1 ? "" : "s"}.` };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: MENSAJE_ACCESO };

  const r = await verifyBuyer(email, password);
  if (!r.ok) {
    registrarFallo(ip);
    return { error: r.error };
  }

  limpiarIntentos(ip);
  const h = await headers();
  await startBuyerSession(r.customerId, h.get("user-agent") ?? undefined);
  redirect(destinoSeguro(formData.get("volver")));
}

export async function crearCuenta(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const r = await registerBuyer({
    name: String(formData.get("name") ?? ""),
    email,
    password,
    phone: String(formData.get("phone") ?? "") || null,
  });
  if (!r.ok) return { error: r.error };

  // El registro no delata si la cuenta ya existía, así que tampoco puede
  // entrar a ciegas: se comprueban las credenciales igual que en el acceso.
  // Quien acaba de crearla entra; quien ya la tenía con otra contraseña, no.
  const login = await verifyBuyer(email, password);
  if (!login.ok) {
    return {
      error: "Ya existe una cuenta con ese correo. Entra con tu contraseña o escríbenos por WhatsApp.",
    };
  }

  const h = await headers();
  await startBuyerSession(login.customerId, h.get("user-agent") ?? undefined);
  redirect("/cuenta");
}

export async function salir(): Promise<void> {
  await endBuyerSession();
  redirect("/");
}

export async function actualizarDatos(_prev: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireBuyer();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Escribe tu nombre completo." };

  await db.customer.update({
    where: { id: buyer.customerId },
    data: {
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
    },
  });

  revalidatePath("/cuenta");
  return { ok: true };
}

export async function cambiarPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireBuyer();

  const r = await changePassword(
    buyer.customerId,
    String(formData.get("actual") ?? ""),
    String(formData.get("nueva") ?? ""),
  );
  if (!r.ok) return { error: r.error };

  // Quien cambia su contraseña sospecha que otra persona entró: si las sesiones
  // abiertas siguieran valiendo, el gesto no serviría de nada. Se conserva la
  // que está usando ahora para no echarlo de su propia pantalla.
  await revokeAllSessions(buyer.customerId, await currentBuyerToken());

  return { ok: true };
}
