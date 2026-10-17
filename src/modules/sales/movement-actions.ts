"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { registrarMovimientoManual, type ResultadoRegistro } from "./movements";

/** "Registrar movimiento" en Movimientos. Solo el administrador (`sales:record`). */
export async function registrarMovimiento(datos: {
  kind: "INGRESO" | "EGRESO";
  monto: number;
  motivo: string;
}): Promise<ResultadoRegistro> {
  const session = await requirePermission("sales:record");
  const r = await registrarMovimientoManual(datos, session.user.id);
  if (r.ok) revalidatePath("/admin/ventas");
  return r;
}
