"use server";

// La acción de la caja: exige el permiso contra la BASE (revocación inmediata)
// y delega en el núcleo, que no sabe de sesiones.
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { registrarVentaPos, type VentaPosResult } from "./sale";
import { buscarClientePorCelular, type ClientePos } from "./customers";
import {
  abrirTurno,
  cerrarTurno,
  dejarBase,
  registrarSalida,
  resumenDeTurno,
  type ResultadoTurno,
  type ResumenTurno,
} from "./turno";

/** "Buscar" del cobro: el cliente de ese celular, o `null` si es nuevo. Mismo permiso que cobrar. */
export async function buscarClienteCaja(celular: string): Promise<ClientePos | null> {
  await requirePermission("pos:sell");
  return buscarClientePorCelular(celular);
}

export async function cobrarVentaPos(input: unknown): Promise<VentaPosResult> {
  const session = await requirePermission("pos:sell");
  const r = await registrarVentaPos(input, session.user.id);
  if (r.ok) {
    revalidatePath("/pos");
    revalidatePath("/admin/inventario");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/clientes");
  }
  return r;
}

// ── Turno de caja ──
// Mismo permiso que cobrar: abrir, registrar salidas y cerrar son parte de vender.

export async function abrirCaja(base: number): Promise<ResultadoTurno<{ id: string }>> {
  const session = await requirePermission("pos:sell");
  const r = await abrirTurno(base, session.user.id);
  if (r.ok) revalidatePath("/pos");
  return r;
}

/** Salida de dinero del cajón (compra para el local, domicilio…). */
export async function registrarSalidaCaja(monto: number, motivo: string): Promise<ResultadoTurno<{ id: string }>> {
  const session = await requirePermission("pos:sell");
  return registrarSalida(monto, motivo, session.user.id);
}

/** El resumen del turno abierto, para la pantalla previa al cierre. */
export async function resumenCaja(sessionId: string): Promise<ResumenTurno | null> {
  await requirePermission("pos:sell");
  return resumenDeTurno(sessionId);
}

export async function cerrarCaja(sessionId: string): Promise<ResultadoTurno<{ resumen: ResumenTurno }>> {
  const session = await requirePermission("pos:sell");
  const r = await cerrarTurno(sessionId, session.user.id);
  if (r.ok) revalidatePath("/pos");
  return r;
}

export async function dejarBaseCaja(sessionId: string, monto: number | null): Promise<ResultadoTurno> {
  await requirePermission("pos:sell");
  return dejarBase(sessionId, monto);
}
