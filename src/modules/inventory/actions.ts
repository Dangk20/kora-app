"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/auth";
import { setStockTo, StockError } from "./engine";

export type ActionResult =
  | { ok: true; from: number; to: number }
  | { ok: false; error: string }
  | null;

const schema = z.object({
  variantId: z.string().min(1),
  target: z.coerce.number().int("Debe ser un entero").min(0, "No puede ser negativo"),
  reason: z.enum(["AJUSTE_MANUAL", "MERMA", "DEVOLUCION", "COMPRA_INICIAL"]),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export async function adjustStock(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("inventory:adjust");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await setStockTo({
      ...parsed.data,
      actorId: session.user.id,
    });
    revalidatePath("/admin/inventario");
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof StockError) {
      return { ok: false, error: "La variante no existe" };
    }
    throw e;
  }
}
