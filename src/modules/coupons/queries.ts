// Consultas del panel de cupones.
// Ver openspec/changes/modulo-cupones — specs/coupon-management.

import { db } from "@/lib/db";
import { couponStatus, type CouponStatus } from "./status";

type Db = typeof db;

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  type: "PERCENT" | "FIXED" | "FREE_PRODUCT";
  percentValue: number | null;
  amountCop: number | null;
  amountUsd: number | null;
  freeProductName: string | null;
  usedCount: number;
  maxUses: number | null;
  validTo: Date | null;
  active: boolean;
  status: CouponStatus;
};

/**
 * Listado con su estado ya derivado.
 *
 * El estado se calcula aquí y no se filtra en la base a propósito: es la MISMA
 * función que usa el canje, y eso es lo que impide que el panel diga "Activo"
 * sobre un cupón que el checkout rechaza. Con decenas de cupones —que es lo
 * que tiene un negocio— el coste es irrelevante.
 */
export async function listCoupons(search = "", client: Db = db): Promise<CouponRow[]> {
  const q = search.trim();
  const cupones = await client.coupon.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q.toUpperCase() } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { freeVariant: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  return cupones.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    percentValue: c.percentValue === null ? null : Number(c.percentValue),
    amountCop: c.amountCop === null ? null : Number(c.amountCop),
    amountUsd: c.amountUsd === null ? null : Number(c.amountUsd),
    freeProductName: c.freeVariant
      ? `${c.freeVariant.product.name}${c.freeVariant.name !== "Única" ? ` · ${c.freeVariant.name}` : ""}`
      : null,
    usedCount: c.usedCount,
    maxUses: c.maxUses,
    validTo: c.validTo,
    active: c.active,
    status: couponStatus(c),
  }));
}

export function countByStatus(rows: CouponRow[]): Record<CouponStatus | "ALL", number> {
  return {
    ALL: rows.length,
    ACTIVE: rows.filter((r) => r.status === "ACTIVE").length,
    EXPIRED: rows.filter((r) => r.status === "EXPIRED").length,
    EXHAUSTED: rows.filter((r) => r.status === "EXHAUSTED").length,
    INACTIVE: rows.filter((r) => r.status === "INACTIVE").length,
  };
}

/** Texto del valor del descuento, según el tipo (CUP_HU001 §3). */
export function discountLabel(c: CouponRow): string {
  if (c.type === "PERCENT") return `−${c.percentValue}%`;
  if (c.type === "FREE_PRODUCT") return `🎁 ${c.freeProductName ?? "Producto gratis"}`;
  const partes: string[] = [];
  if (c.amountCop) partes.push(`−$${c.amountCop.toLocaleString("es-CO")} COP`);
  if (c.amountUsd) partes.push(`−$${c.amountUsd} USD`);
  return partes.join(" · ") || "−";
}
