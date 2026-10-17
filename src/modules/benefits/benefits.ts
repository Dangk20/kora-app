// Beneficios de los clientes (change beneficios, 17 oct 2026): la ruleta de la
// apertura y los que el administrador otorga a mano. Vigencia de 30 días.
//
//   CASHBACK             → se acredita al otorgarse como lote propio (vence
//                          con el beneficio) y se gasta como cualquier cashback.
//   DESCUENTO_CATEGORIA  → % sobre los productos de una categoría, en UNA compra.
//   PRODUCTO_GRATIS      → un producto de regalo, entregado en la tienda.
//
// Los dos últimos se canjean en la caja (pos/sale.ts) dentro de la misma
// transacción de la venta: un beneficio no puede usarse dos veces aunque dos
// cajas lo intenten a la vez (FOR UPDATE sobre la fila del beneficio).
import type { BenefitKind, BenefitSource, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { creditCashback } from "@/modules/cashback/ledger";
import { aNumero } from "@/modules/cashback/money";
import { formatOrderNumber } from "@/modules/orders/message";

export const VIGENCIA_BENEFICIO_DIAS = 30;

export type EstadoBeneficio = "VIGENTE" | "USADO" | "VENCIDO";

export type BeneficioCliente = {
  id: string;
  kind: BenefitKind;
  source: BenefitSource;
  title: string;
  amount: number | null;
  categoryName: string | null;
  variantLabel: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  usedOrderNumber: string | null;
  estado: EstadoBeneficio;
  createdAt: Date;
};

type Tx = Prisma.TransactionClient;

export function estadoDe(b: { usedAt: Date | null; expiresAt: Date }, ahora = new Date()): EstadoBeneficio {
  if (b.usedAt) return "USADO";
  return b.expiresAt.getTime() <= ahora.getTime() ? "VENCIDO" : "VIGENTE";
}

export type NuevoBeneficio = {
  customerId: string;
  kind: BenefitKind;
  source?: BenefitSource;
  title?: string;
  /** CASHBACK: pesos. DESCUENTO_CATEGORIA: porcentaje 1–100. */
  amount?: number;
  categoryId?: string;
  variantId?: string;
  grantedById?: string;
  now?: Date;
};

export type ResultadoBeneficio = { ok: true; id: string } | { ok: false; error: string };

/** Otorga un beneficio. Con `tx`, dentro de la transacción de quien llama (la ruleta). */
export async function otorgarBeneficio(datos: NuevoBeneficio, tx?: Tx): Promise<ResultadoBeneficio> {
  const ahora = datos.now ?? new Date();
  const expiresAt = new Date(ahora.getTime() + VIGENCIA_BENEFICIO_DIAS * 24 * 3600_000);
  const correr = async (t: Tx): Promise<ResultadoBeneficio> => {
    const cliente = await t.customer.findUnique({ where: { id: datos.customerId }, select: { id: true } });
    if (!cliente) return { ok: false, error: "El cliente no existe" };

    if (datos.kind === "CASHBACK") {
      const monto = Math.round(datos.amount ?? 0);
      if (monto <= 0) return { ok: false, error: "Escribe el valor del cashback de regalo" };
      const titulo = datos.title?.trim() || `$${monto.toLocaleString("es-CO")} de Kora Cashback de regalo`;
      const lote = await creditCashback(t, {
        customerId: datos.customerId,
        amount: monto,
        currency: "COP",
        expiresAt,
        note: `Beneficio: ${titulo}`,
        now: ahora,
      });
      const b = await t.benefit.create({
        data: {
          customerId: datos.customerId, kind: "CASHBACK", source: datos.source ?? "MANUAL", title: titulo,
          amount: monto, cashbackMovementId: lote.id, expiresAt, grantedById: datos.grantedById, createdAt: ahora,
        },
      });
      return { ok: true, id: b.id };
    }

    if (datos.kind === "DESCUENTO_CATEGORIA") {
      const pct = Math.round(datos.amount ?? 0);
      if (pct < 1 || pct > 100) return { ok: false, error: "El descuento va de 1% a 100%" };
      const cat = datos.categoryId ? await t.category.findUnique({ where: { id: datos.categoryId }, select: { name: true } }) : null;
      if (!cat) return { ok: false, error: "Elige la categoría del descuento" };
      const b = await t.benefit.create({
        data: {
          customerId: datos.customerId, kind: "DESCUENTO_CATEGORIA", source: datos.source ?? "MANUAL",
          title: datos.title?.trim() || `${pct}% en ${cat.name}`, amount: pct, categoryId: datos.categoryId,
          expiresAt, grantedById: datos.grantedById, createdAt: ahora,
        },
      });
      return { ok: true, id: b.id };
    }

    // PRODUCTO_GRATIS
    const v = datos.variantId
      ? await t.variant.findUnique({ where: { id: datos.variantId }, select: { name: true, product: { select: { name: true } } } })
      : null;
    if (!v) return { ok: false, error: "Elige el producto de regalo" };
    const b = await t.benefit.create({
      data: {
        customerId: datos.customerId, kind: "PRODUCTO_GRATIS", source: datos.source ?? "MANUAL",
        title: datos.title?.trim() || `${v.product.name} de regalo`, variantId: datos.variantId,
        expiresAt, grantedById: datos.grantedById, createdAt: ahora,
      },
    });
    return { ok: true, id: b.id };
  };
  return tx ? correr(tx) : db.$transaction(correr);
}

const SELECT = {
  id: true, kind: true, source: true, title: true, amount: true, expiresAt: true, usedAt: true, createdAt: true,
  category: { select: { name: true } },
  variant: { select: { name: true, product: { select: { name: true } } } },
  usedOrder: { select: { number: true, createdAt: true } },
  cashbackMovement: { select: { remaining: true } },
} as const;

/** Todos los beneficios del cliente: vigentes primero, luego por fecha. */
export async function beneficiosDe(customerId: string, ahora = new Date()): Promise<BeneficioCliente[]> {
  const filas = await db.benefit.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, select: SELECT });
  const orden: Record<EstadoBeneficio, number> = { VIGENTE: 0, USADO: 1, VENCIDO: 2 };
  return filas
    .map((b) => {
      // Un cashback de regalo está "usado" cuando su lote ya se gastó entero.
      const gastado = b.kind === "CASHBACK" && b.cashbackMovement && aNumero(b.cashbackMovement.remaining ?? 0) <= 0;
      const usedAt = b.usedAt ?? (gastado ? b.createdAt : null);
      return {
        id: b.id,
        kind: b.kind,
        source: b.source,
        title: b.title,
        amount: b.amount === null ? null : aNumero(b.amount),
        categoryName: b.category?.name ?? null,
        variantLabel: b.variant ? `${b.variant.product.name}${/^[úu]nica$/i.test(b.variant.name) ? "" : ` · ${b.variant.name}`}` : null,
        expiresAt: b.expiresAt,
        usedAt,
        usedOrderNumber: b.usedOrder ? formatOrderNumber(b.usedOrder.number, b.usedOrder.createdAt) : null,
        estado: estadoDe({ usedAt, expiresAt: b.expiresAt }, ahora),
        createdAt: b.createdAt,
      };
    })
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.createdAt.getTime() - a.createdAt.getTime());
}

/** Lo que se puede canjear en la caja: descuentos y regalos vigentes (el cashback va por el saldo). */
export async function beneficiosParaCaja(customerId: string): Promise<BeneficioCliente[]> {
  return (await beneficiosDe(customerId)).filter((b) => b.estado === "VIGENTE" && b.kind !== "CASHBACK");
}

export class BeneficioNoDisponible extends Error {
  constructor(public readonly motivo: string) {
    super("BENEFICIO_NO_DISPONIBLE");
  }
}

/**
 * Bloquea el beneficio para canjearlo dentro de la transacción de la venta.
 * Lanza `BeneficioNoDisponible` si no es de este cliente, ya se usó o venció.
 */
export async function tomarBeneficio(tx: Tx, benefitId: string, customerId: string, ahora = new Date()) {
  const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM benefits WHERE id = ${benefitId} FOR UPDATE`;
  if (filas.length === 0) throw new BeneficioNoDisponible("El beneficio no existe");
  const b = await tx.benefit.findUniqueOrThrow({
    where: { id: benefitId },
    select: { id: true, customerId: true, kind: true, amount: true, categoryId: true, variantId: true, usedAt: true, expiresAt: true, title: true },
  });
  if (b.customerId !== customerId) throw new BeneficioNoDisponible("El beneficio es de otro cliente");
  const estado = estadoDe(b, ahora);
  if (estado === "USADO") throw new BeneficioNoDisponible("Ese beneficio ya se usó");
  if (estado === "VENCIDO") throw new BeneficioNoDisponible("Ese beneficio ya venció");
  if (b.kind === "CASHBACK") throw new BeneficioNoDisponible("El cashback de regalo se usa como saldo, no como beneficio de caja");
  return { ...b, amount: b.amount === null ? null : aNumero(b.amount) };
}
