"use server";

// Perillas de la ruleta desde el panel: abrirla o cerrarla, y cuánto sale y
// cuántos hay de cada premio. Solo el administrador ("loyalty:adjust"):
// regalar cashback y productos mueve dinero del negocio.
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { PREMIOS, guardarConfig, leerConfig } from "./premios";

export type AjusteResultado = { ok: true } | { ok: false; error: string };

export async function cambiarEstadoRuleta(activa: boolean): Promise<AjusteResultado> {
  await requirePermission("loyalty:adjust");
  const config = await leerConfig();
  await guardarConfig({ ...config, activa });
  revalidatePath("/admin/ruleta");
  revalidatePath("/ruleta");
  return { ok: true };
}

export async function guardarPremiosRuleta(formData: FormData): Promise<AjusteResultado> {
  await requirePermission("loyalty:adjust");
  const config = await leerConfig();
  const premios = { ...config.premios };
  for (const p of PREMIOS) {
    const peso = Number(formData.get(`peso-${p.key}`));
    const topeCrudo = String(formData.get(`tope-${p.key}`) ?? "").trim();
    const tope = topeCrudo === "" ? null : Number(topeCrudo);
    if (!Number.isInteger(peso) || peso < 0 || peso > 1000) {
      return { ok: false, error: `El peso de "${p.titulo}" debe ser un número entero entre 0 y 1000` };
    }
    if (tope !== null && (!Number.isInteger(tope) || tope < 0)) {
      return { ok: false, error: `El tope de "${p.titulo}" debe ser un número entero, o vacío para no tener tope` };
    }
    premios[p.key] = { peso, tope };
  }
  if (Object.values(premios).every((p) => p.peso === 0)) {
    return { ok: false, error: "Al menos un premio debe tener peso: en esta ruleta todos ganan" };
  }
  await guardarConfig({ ...config, premios });
  revalidatePath("/admin/ruleta");
  return { ok: true };
}
