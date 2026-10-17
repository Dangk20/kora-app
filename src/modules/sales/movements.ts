// Movimientos del negocio (Daniel, 17 oct 2026): la vista de Ventas pasa a ser
// el libro de lo que entra y lo que sale.
//   - VENTA:      ingreso. Una venta confirmada (web o caja), con la definición de siempre.
//   - MOVIMIENTO: ingreso o egreso que no es venta. Desde la caja (salida de
//                 efectivo en un turno) o registrado a mano por el administrador.
//   - CIERRE:     el corte de cada turno de caja, con su base. No es dinero que
//                 entre ni que salga; se muestra como constancia del día.
//
// Las monedas siguen sin sumarse: los movimientos y los cierres son en pesos.
import type { Currency, MovementKind, SaleChannel } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { aNumero } from "@/modules/cashback/money";
import { whereFrom, type SalesFilters } from "./definition";

export type TipoMovimiento = "INGRESO" | "EGRESO" | "CIERRE";

export type Movimiento =
  | {
      clase: "VENTA";
      tipo: "INGRESO";
      id: string;
      fecha: Date;
      orderId: string;
      number: number;
      customerName: string | null;
      channel: SaleChannel;
      currency: Currency;
      monto: number;
      discountTotal: number;
      cashbackApplied: number;
    }
  | {
      clase: "MOVIMIENTO";
      tipo: "INGRESO" | "EGRESO";
      /** CAJA = salida del cajón en un turno; MANUAL = registrado por el administrador. */
      origen: "CAJA" | "MANUAL";
      id: string;
      fecha: Date;
      motivo: string;
      registradoPor: string;
      monto: number;
    }
  | {
      clase: "CIERRE";
      tipo: "CIERRE";
      id: string;
      fecha: Date;
      caja: string;
      cerradoPor: string;
      baseInicial: number;
      ventas: number;
      totalVendido: number;
      salidas: number;
      efectivoEnCaja: number;
      /** null = cerró sin dejar base. */
      baseDejada: number | null;
    };

export type FiltrosMovimientos = SalesFilters & { tipo?: TipoMovimiento };

export const PAGE_SIZE = 25;

/**
 * Movimientos y cierres son en pesos. Los manuales no tienen canal; los de
 * caja son del POS. Filtrar "Online" deja solo ventas; filtrar USD, también.
 */
function incluyeMovimientos(f: FiltrosMovimientos) {
  return f.channel !== "WEB" && f.currency !== "USD";
}

function rangoFechas(f: FiltrosMovimientos) {
  return f.from || f.to ? { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } : undefined;
}

/** Con canal POS, solo lo que salió del cajón; sin canal, también lo manual. */
function whereMovimientos(f: FiltrosMovimientos, kind?: MovementKind) {
  return {
    createdAt: rangoFechas(f),
    ...(kind ? { kind } : {}),
    ...(f.channel === "POS" ? { sessionId: { not: null } } : {}),
  };
}

/** Totales de movimientos (pesos) del periodo: egresos e ingresos que no son venta. */
export async function totalesMovimientos(
  f: FiltrosMovimientos,
): Promise<{ egresos: number; cantidadEgresos: number; ingresosManuales: number; cantidadIngresos: number }> {
  if (!incluyeMovimientos(f)) return { egresos: 0, cantidadEgresos: 0, ingresosManuales: 0, cantidadIngresos: 0 };
  const grupos = await db.cashMovement.groupBy({
    by: ["kind"],
    where: whereMovimientos(f),
    _sum: { amount: true },
    _count: { _all: true },
  });
  const de = (k: MovementKind) => grupos.find((g) => g.kind === k);
  return {
    egresos: aNumero(de("EGRESO")?._sum.amount ?? 0),
    cantidadEgresos: de("EGRESO")?._count._all ?? 0,
    ingresosManuales: aNumero(de("INGRESO")?._sum.amount ?? 0),
    cantidadIngresos: de("INGRESO")?._count._all ?? 0,
  };
}

/**
 * Una página del libro, los tipos mezclados por fecha (más reciente primero).
 * Se piden hasta `page × pageSize` de cada fuente y se intercalan en memoria:
 * con el volumen de una tienda (cientos al mes) es más simple y correcto que
 * una unión en SQL que tendría que repetir la definición de venta.
 */
export async function listMovimientos(
  f: FiltrosMovimientos & { page?: number; pageSize?: number },
): Promise<{ rows: Movimiento[]; total: number; page: number; totalPages: number }> {
  const pageSize = f.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, f.page ?? 1);
  const tope = page * pageSize;
  const mov = incluyeMovimientos(f);
  const verVentas = !f.tipo || f.tipo === "INGRESO";
  const verMovs = mov && f.tipo !== "CIERRE";
  const verCierres = mov && (!f.tipo || f.tipo === "CIERRE");
  const kind: MovementKind | undefined = f.tipo === "INGRESO" ? "INGRESO" : f.tipo === "EGRESO" ? "EGRESO" : undefined;
  const fechas = rangoFechas(f);
  const whereMov = whereMovimientos(f, kind);
  const whereCierre = { closedAt: { not: null, ...(fechas ?? {}) } };

  const [ventas, nVentas, movimientos, nMovs, cierres, nCierres] = await Promise.all([
    verVentas
      ? db.order.findMany({
          where: whereFrom(f),
          orderBy: { confirmedAt: "desc" },
          take: tope,
          select: {
            id: true, number: true, confirmedAt: true, channel: true, currency: true,
            total: true, discountTotal: true, cashbackApplied: true, customer: { select: { name: true } },
          },
        })
      : [],
    verVentas ? db.order.count({ where: whereFrom(f) }) : 0,
    verMovs
      ? db.cashMovement.findMany({
          where: whereMov,
          orderBy: { createdAt: "desc" },
          take: tope,
          select: { id: true, kind: true, sessionId: true, createdAt: true, reason: true, amount: true, createdBy: { select: { name: true } } },
        })
      : [],
    verMovs ? db.cashMovement.count({ where: whereMov }) : 0,
    verCierres
      ? db.cashSession.findMany({
          where: whereCierre,
          orderBy: { closedAt: "desc" },
          take: tope,
          select: {
            id: true, register: true, closedAt: true, openingBase: true, baseLeft: true, summary: true,
            closedBy: { select: { name: true } },
          },
        })
      : [],
    verCierres ? db.cashSession.count({ where: whereCierre }) : 0,
  ]);

  const filas: Movimiento[] = [
    ...ventas.map((o) => ({
      clase: "VENTA" as const,
      tipo: "INGRESO" as const,
      id: `v-${o.id}`,
      fecha: o.confirmedAt as Date,
      orderId: o.id,
      number: o.number,
      customerName: o.customer?.name ?? null,
      channel: o.channel,
      currency: o.currency,
      monto: aNumero(o.total),
      discountTotal: aNumero(o.discountTotal),
      cashbackApplied: aNumero(o.cashbackApplied),
    })),
    ...movimientos.map((m) => ({
      clase: "MOVIMIENTO" as const,
      tipo: m.kind,
      origen: m.sessionId ? ("CAJA" as const) : ("MANUAL" as const),
      id: `m-${m.id}`,
      fecha: m.createdAt,
      motivo: m.reason,
      registradoPor: m.createdBy.name,
      monto: aNumero(m.amount),
    })),
    ...cierres.map((c) => {
      // El resumen congelado al cerrar (pos/turno.ts › ResumenTurno).
      const r = (c.summary ?? {}) as { ventas?: number; total?: number; totalSalidas?: number; efectivoEnCaja?: number };
      return {
        clase: "CIERRE" as const,
        tipo: "CIERRE" as const,
        id: `c-${c.id}`,
        fecha: c.closedAt as Date,
        caja: c.register,
        cerradoPor: c.closedBy?.name ?? "—",
        baseInicial: aNumero(c.openingBase),
        ventas: r.ventas ?? 0,
        totalVendido: r.total ?? 0,
        salidas: r.totalSalidas ?? 0,
        efectivoEnCaja: r.efectivoEnCaja ?? 0,
        baseDejada: c.baseLeft === null ? null : aNumero(c.baseLeft),
      };
    }),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const total = nVentas + nMovs + nCierres;
  return {
    rows: filas.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ResultadoRegistro = { ok: true } | { ok: false; error: string };

/** Ingreso o egreso manual del administrador (sin turno de caja). Núcleo sin sesión. */
export async function registrarMovimientoManual(
  datos: { kind: MovementKind; monto: number; motivo: string },
  actorId: string,
): Promise<ResultadoRegistro> {
  const monto = Math.round(datos.monto);
  if (datos.kind !== "INGRESO" && datos.kind !== "EGRESO") return { ok: false, error: "Elige si es ingreso o egreso" };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: "Escribe el valor del movimiento" };
  const motivo = datos.motivo.trim();
  if (motivo.length < 3) return { ok: false, error: "Escribe el concepto del movimiento" };
  await db.cashMovement.create({
    data: { kind: datos.kind, sessionId: null, amount: monto, reason: motivo.slice(0, 200), createdById: actorId },
  });
  return { ok: true };
}
