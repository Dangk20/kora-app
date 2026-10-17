"use server";

// Acciones de beneficios. Otorgar a mano es del administrador ("loyalty:adjust":
// regalar cashback o descuentos mueve dinero del negocio). Ver los beneficios
// de un cliente en la caja va con el permiso de cobrar.
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import type { BenefitKind } from "@/generated/prisma/client";
import { previsualizarBeneficio } from "@/modules/pos/sale";
import { beneficiosParaCaja, otorgarBeneficio, type BeneficioCliente, type ResultadoBeneficio } from "./benefits";

export async function otorgarBeneficioAdmin(datos: {
  customerId: string;
  kind: BenefitKind;
  amount?: number;
  categoryId?: string;
  variantId?: string;
}): Promise<ResultadoBeneficio> {
  const session = await requirePermission("loyalty:adjust");
  const r = await otorgarBeneficio({ ...datos, source: "MANUAL", grantedById: session.user.id });
  if (r.ok) revalidatePath("/admin/clientes");
  return r;
}

/** Cuánto descuenta el beneficio sobre el ticket, calculado con los precios del servidor. */
export async function descuentoBeneficioCaja(benefitId: string, lines: { variantId: string; qty: number }[]) {
  await requirePermission("pos:sell");
  return previsualizarBeneficio(benefitId, lines);
}

export async function beneficiosCaja(customerId: string): Promise<BeneficioCliente[]> {
  await requirePermission("pos:sell");
  return beneficiosParaCaja(customerId);
}
