"use server";

// Alta, edición y pausa de cupones.
// Ver openspec/changes/modulo-cupones — specs/coupon-management.
//
// NO existe eliminación: los pedidos históricos referencian el cupón, y
// borrarlo rompería la trazabilidad de la campaña — que es la única razón por
// la que un cupón se registra en lugar de descontarse a mano en el chat.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";

export type CouponActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: string };

const CODE_RE = /^[A-Z0-9]{3,20}$/;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre interno"),
  description: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  type: z.enum(["PERCENT", "FIXED", "FREE_PRODUCT"]),
  percentValue: z.coerce.number().optional(),
  amountCop: z.coerce.number().optional(),
  amountUsd: z.coerce.number().optional(),
  // Compra mínima, uno por moneda: COP y USD no se convierten.
  minSubtotalCop: z.coerce.number().optional(),
  minSubtotalUsd: z.coerce.number().optional(),
  freeVariantId: z.string().optional().or(z.literal("").transform(() => undefined)),
  validFrom: z.string().optional().or(z.literal("").transform(() => undefined)),
  validTo: z.string().optional().or(z.literal("").transform(() => undefined)),
  maxUses: z.string().optional(),
  perCustomerLimit: z.string().optional(),
  active: z.coerce.boolean().optional(),
  firstPurchaseOnly: z.coerce.boolean().optional(),
  appliesToSaleItems: z.coerce.boolean().optional(),
  scope: z.enum(["ALL", "CATEGORIES", "PRODUCTS"]),
  categoryIds: z.string().optional(),
  productIds: z.string().optional(),
});

function firstError(e: z.ZodError): { error: string; field?: string } {
  const i = e.issues[0];
  return { error: i.message, field: String(i.path[0] ?? "") };
}

function opcionalInt(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function opcionalFecha(v: string | undefined): Date | null {
  if (!v || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function listaIds(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Reglas de valor y coherencia comunes al alta y a la edición. */
function validarValores(
  d: z.infer<typeof baseSchema>,
): { error: string; field?: string } | null {
  if (d.type === "PERCENT") {
    const p = d.percentValue ?? 0;
    if (!(p > 0 && p <= 100)) {
      return { error: "El porcentaje debe estar entre 1 y 100.", field: "percentValue" };
    }
  }

  if (d.type === "FIXED") {
    const cop = d.amountCop ?? 0;
    const usd = d.amountUsd ?? 0;
    if (cop <= 0 && usd <= 0) {
      return {
        error: "Indica el descuento en al menos una moneda.",
        field: "amountCop",
      };
    }
  }

  if (d.type === "FREE_PRODUCT" && !d.freeVariantId) {
    return { error: "Elige el producto que se regala.", field: "freeVariantId" };
  }

  const desde = opcionalFecha(d.validFrom);
  const hasta = opcionalFecha(d.validTo);
  if (desde && hasta && hasta.getTime() < desde.getTime()) {
    return { error: 'La fecha de vencimiento no puede ser anterior a "válido desde".', field: "validTo" };
  }

  if (d.scope === "CATEGORIES" && listaIds(d.categoryIds).length === 0) {
    return { error: "Elige al menos una categoría.", field: "categoryIds" };
  }
  if (d.scope === "PRODUCTS" && listaIds(d.productIds).length === 0) {
    return { error: "Elige al menos un producto.", field: "productIds" };
  }
  return null;
}

function datosComunes(d: z.infer<typeof baseSchema>) {
  return {
    name: d.name,
    description: d.description ?? null,
    type: d.type,
    percentValue: d.type === "PERCENT" ? (d.percentValue ?? 0) : null,
    amountCop: d.type === "FIXED" && (d.amountCop ?? 0) > 0 ? d.amountCop! : null,
    amountUsd: d.type === "FIXED" && (d.amountUsd ?? 0) > 0 ? d.amountUsd! : null,
    // El mínimo aplica a CUALQUIER tipo de cupón, no solo al de monto fijo:
    // "20% desde $100.000" es tan razonable como "$20.000 desde $100.000".
    // Vacío o cero = sin mínimo; se guarda null para que la validación no
    // tenga que distinguir "cero" de "sin definir".
    minSubtotalCop: (d.minSubtotalCop ?? 0) > 0 ? d.minSubtotalCop! : null,
    minSubtotalUsd: (d.minSubtotalUsd ?? 0) > 0 ? d.minSubtotalUsd! : null,
    freeVariantId: d.type === "FREE_PRODUCT" ? (d.freeVariantId ?? null) : null,
    validFrom: opcionalFecha(d.validFrom),
    validTo: opcionalFecha(d.validTo),
    maxUses: opcionalInt(d.maxUses),
    perCustomerLimit: opcionalInt(d.perCustomerLimit),
    active: d.active ?? false,
    firstPurchaseOnly: d.firstPurchaseOnly ?? false,
    appliesToSaleItems: d.appliesToSaleItems ?? false,
    scope: d.scope,
  };
}

export async function createCoupon(formData: FormData): Promise<CouponActionResult> {
  await requirePermission("coupons:create");

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return {
      ok: false,
      error: "El código debe tener entre 3 y 20 caracteres, solo letras y números.",
      field: "code",
    };
  }

  const parsed = baseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, ...firstError(parsed.error) };
  const d = parsed.data;

  const problema = validarValores(d);
  if (problema) return { ok: false, ...problema };

  if (await db.coupon.findUnique({ where: { code }, select: { id: true } })) {
    return { ok: false, error: "Ya existe un cupón con ese código.", field: "code" };
  }

  const cupon = await db.coupon.create({
    data: {
      code,
      ...datosComunes(d),
      categories:
        d.scope === "CATEGORIES"
          ? { create: listaIds(d.categoryIds).map((categoryId) => ({ categoryId })) }
          : undefined,
      products:
        d.scope === "PRODUCTS"
          ? { create: listaIds(d.productIds).map((productId) => ({ productId })) }
          : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/admin/cupones");
  return { ok: true, id: cupon.id };
}

/**
 * Editar. El código NO se toca: es lo que el comprador escribe y lo que queda
 * en los pedidos. Cambiarlo dejaría campañas ya enviadas apuntando a nada.
 */
export async function updateCoupon(formData: FormData): Promise<CouponActionResult> {
  await requirePermission("coupons:edit");

  const id = String(formData.get("id") ?? "");
  const actual = await db.coupon.findUnique({
    where: { id },
    select: { id: true, usedCount: true },
  });
  if (!actual) return { ok: false, error: "Ese cupón ya no existe." };

  const parsed = baseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, ...firstError(parsed.error) };
  const d = parsed.data;

  const problema = validarValores(d);
  if (problema) return { ok: false, ...problema };

  // Bajar el cupo por debajo de lo ya usado dejaría el cupón en un estado
  // imposible —agotado con cupo negativo— y volvería incoherentes los
  // contadores del panel.
  const maxUses = opcionalInt(d.maxUses);
  if (maxUses !== null && maxUses < actual.usedCount) {
    return {
      ok: false,
      error: `Este cupón ya tiene ${actual.usedCount} usos: el máximo no puede ser menor.`,
      field: "maxUses",
    };
  }

  await db.$transaction([
    db.couponCategory.deleteMany({ where: { couponId: id } }),
    db.couponProduct.deleteMany({ where: { couponId: id } }),
    db.coupon.update({
      where: { id },
      data: {
        ...datosComunes(d),
        categories:
          d.scope === "CATEGORIES"
            ? { create: listaIds(d.categoryIds).map((categoryId) => ({ categoryId })) }
            : undefined,
        products:
          d.scope === "PRODUCTS"
            ? { create: listaIds(d.productIds).map((productId) => ({ productId })) }
            : undefined,
      },
    }),
  ]);

  revalidatePath("/admin/cupones");
  return { ok: true, id };
}

/**
 * Pausar o reactivar. Es la ÚNICA forma de sacar un cupón de circulación.
 *
 * Los pedidos ya creados con él no se ven afectados: su descuento vive en el
 * snapshot inmutable del pedido.
 */
export async function toggleCoupon(formData: FormData): Promise<CouponActionResult> {
  await requirePermission("coupons:edit");

  const id = String(formData.get("id") ?? "");
  const cupon = await db.coupon.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!cupon) return { ok: false, error: "Ese cupón ya no existe." };

  await db.coupon.update({ where: { id }, data: { active: !cupon.active } });
  revalidatePath("/admin/cupones");
  return { ok: true, id };
}
