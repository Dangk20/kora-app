// Turno de caja (change s09-pos-caja). Abrir con base → vender → cerrar con el
// resumen del día → dejar (o no) base para el siguiente turno.
//
// Sin sesión a propósito, como `sale.ts`: las acciones de `actions.ts` exigen
// el permiso y llaman aquí, y las pruebas ejercitan el código real.
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const CAJA = "Caja 1";

export type TurnoAbierto = {
  id: string;
  openedAt: Date;
  openingBase: number;
  openedByName: string;
};

export type ResumenTurno = {
  ventas: number;
  total: number;
  /** Monto por método de pago, en el orden en que se muestran. */
  porMetodo: { metodo: string; monto: number; ventas: number }[];
  base: number;
  /** Salidas de efectivo del turno (compras para el local, domicilios…). */
  salidas: { monto: number; motivo: string; hora: string }[];
  totalSalidas: number;
  /** Base + ventas en efectivo − salidas: lo que debería haber en el cajón. */
  efectivoEnCaja: number;
};

const num = (d: { toString(): string } | null | undefined) => (d ? Number(d.toString()) : 0);
const ORDEN_METODOS = ["Efectivo", "Datáfono", "Transferencia"];

export async function turnoAbierto(register = CAJA): Promise<TurnoAbierto | null> {
  const t = await db.cashSession.findFirst({
    where: { register, closedAt: null },
    select: { id: true, openedAt: true, openingBase: true, openedBy: { select: { name: true } } },
  });
  return t ? { id: t.id, openedAt: t.openedAt, openingBase: num(t.openingBase), openedByName: t.openedBy.name } : null;
}

/** La base que dejó el último cierre (null = cerró sin base, o nunca hubo turno). */
export async function baseDejada(register = CAJA): Promise<number | null> {
  const t = await db.cashSession.findFirst({
    where: { register, closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
    select: { baseLeft: true },
  });
  return t?.baseLeft != null ? num(t.baseLeft) : null;
}

export type ResultadoTurno<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function abrirTurno(base: number, actorId: string, register = CAJA): Promise<ResultadoTurno<{ id: string }>> {
  if (!Number.isFinite(base) || base < 0) return { ok: false, error: "La base no es válida" };
  try {
    const t = await db.cashSession.create({ data: { register, openingBase: Math.round(base), openedById: actorId } });
    return { ok: true, id: t.id };
  } catch (e) {
    // El índice único parcial: ya hay un turno abierto en esta caja.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "La caja ya está abierta" };
    }
    throw e;
  }
}

/** El resumen de un turno a partir de SUS ventas (no se recalcula del día). */
export async function resumenDeTurno(
  sessionId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<ResumenTurno | null> {
  const t = await client.cashSession.findUnique({ where: { id: sessionId }, select: { openingBase: true } });
  if (!t) return null;
  const grupos = await client.order.groupBy({
    by: ["paymentPreference"],
    where: { cashSessionId: sessionId, channel: "POS", status: { not: "CANCELLED" } },
    _sum: { total: true },
    _count: { _all: true },
  });
  const porMetodo = ORDEN_METODOS.map((metodo) => {
    const g = grupos.find((x) => x.paymentPreference === metodo);
    return { metodo, monto: num(g?._sum.total), ventas: g?._count._all ?? 0 };
  });
  // Un método que no esté en la lista (dato viejo) no se pierde del total.
  for (const g of grupos) {
    if (!ORDEN_METODOS.includes(g.paymentPreference ?? "")) {
      porMetodo.push({ metodo: g.paymentPreference ?? "Otro", monto: num(g._sum.total), ventas: g._count._all });
    }
  }
  const base = num(t.openingBase);
  const efectivo = porMetodo.find((m) => m.metodo === "Efectivo")?.monto ?? 0;
  const movimientos = await client.cashMovement.findMany({
    where: { sessionId, kind: "EGRESO" },
    orderBy: { createdAt: "asc" },
    select: { amount: true, reason: true, createdAt: true },
  });
  const salidas = movimientos.map((m) => ({
    monto: num(m.amount),
    motivo: m.reason,
    hora: m.createdAt.toISOString(),
  }));
  const totalSalidas = salidas.reduce((s, m) => s + m.monto, 0);
  return {
    ventas: porMetodo.reduce((s, m) => s + m.ventas, 0),
    total: porMetodo.reduce((s, m) => s + m.monto, 0),
    porMetodo,
    base,
    salidas,
    totalSalidas,
    efectivoEnCaja: base + efectivo - totalSalidas,
  };
}

export async function cerrarTurno(sessionId: string, actorId: string): Promise<ResultadoTurno<{ resumen: ResumenTurno }>> {
  return db.$transaction(async (tx) => {
    // Bloquear el turno: una venta que esté entrando espera (toma FOR SHARE), y
    // dos cierres simultáneos se serializan.
    const filas = await tx.$queryRaw<{ closedAt: Date | null }[]>`
      SELECT "closedAt" FROM cash_sessions WHERE id = ${sessionId} FOR UPDATE
    `;
    if (filas.length === 0) return { ok: false as const, error: "El turno no existe" };
    if (filas[0].closedAt) return { ok: false as const, error: "La caja ya estaba cerrada" };
    const resumen = (await resumenDeTurno(sessionId, tx))!;
    await tx.cashSession.update({
      where: { id: sessionId },
      data: { closedAt: new Date(), closedById: actorId, summary: resumen as unknown as Prisma.InputJsonValue },
    });
    return { ok: true as const, resumen };
  });
}

/**
 * Registrar una salida de efectivo del turno abierto. Bloquea el turno como el
 * cierre (FOR UPDATE): una salida no puede colarse en un turno que se cerró
 * mientras el cajero la escribía.
 */
export async function registrarSalida(
  monto: number,
  motivo: string,
  actorId: string,
  register = CAJA,
): Promise<ResultadoTurno<{ id: string }>> {
  const m = Math.round(monto);
  if (!Number.isFinite(m) || m <= 0) return { ok: false, error: "Escribe el valor de la salida" };
  const texto = motivo.trim();
  if (texto.length < 3) return { ok: false, error: "Escribe en qué se usó el dinero" };
  return db.$transaction(async (tx) => {
    const turno = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM cash_sessions WHERE register = ${register} AND "closedAt" IS NULL FOR UPDATE
    `;
    if (turno.length === 0) return { ok: false as const, error: "La caja está cerrada" };
    const r = await tx.cashMovement.create({
      data: { kind: "EGRESO", sessionId: turno[0].id, amount: m, reason: texto.slice(0, 200), createdById: actorId },
    });
    return { ok: true as const, id: r.id };
  });
}

/** Después del cierre: lo que queda en el cajón para el siguiente turno (null = sin base). */
export async function dejarBase(sessionId: string, monto: number | null): Promise<ResultadoTurno> {
  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) return { ok: false, error: "La base no es válida" };
  const r = await db.cashSession.updateMany({
    where: { id: sessionId, closedAt: { not: null } },
    data: { baseLeft: monto === null ? null : Math.round(monto) },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: "Primero hay que cerrar la caja" };
}
