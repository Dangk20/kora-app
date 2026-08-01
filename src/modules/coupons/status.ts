// Estado derivado del cupón.
// Ver openspec/changes/modulo-cupones — design.md decisión 1.
//
// El estado NO se guarda: se calcula. Un estado guardado hay que mantenerlo al
// día al vencer, al agotarse y al pausar, y cualquier olvido deja el panel
// diciendo "Activo" sobre un cupón que el checkout rechaza — sin que nadie
// pueda saber cuál de las dos pantallas miente.
//
// Esta función la usan el listado, los contadores de los filtros y la
// validación del canje. Es lo que hace imposible esa divergencia.

export type CouponStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "EXHAUSTED";

export const STATUS_LABEL: Record<CouponStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  EXPIRED: "Vencido",
  EXHAUSTED: "Agotado",
};

export type StatusInput = {
  active: boolean;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
};

/**
 * Precedencia fija (CUP_HU001 §2): pausado gana sobre vencido, y vencido sobre
 * agotado. No es arbitrario — es lo que el operador espera ver: si él lo pausó,
 * quiere leer "Inactivo", no "Vencido".
 */
export function couponStatus(c: StatusInput, now: Date = new Date()): CouponStatus {
  if (!c.active) return "INACTIVE";
  if (c.validTo && c.validTo.getTime() < now.getTime()) return "EXPIRED";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "EXHAUSTED";
  return "ACTIVE";
}

/** ¿Está en circulación? Es lo que el canje pregunta primero. */
export function isRedeemable(c: StatusInput, now: Date = new Date()): boolean {
  return couponStatus(c, now) === "ACTIVE";
}
