// Expiración automática de pedidos pendientes (PED_HU003 §2).
//
// Un pedido creado en la tienda vive 2 horas; si nadie confirma el pago en
// ese lapso se cancela solo, con actor `sistema`. Sin efecto en inventario:
// el stock nunca se descontó (no hay reserva).
import { db } from "@/lib/db";

export type ExpiryResult = { expired: number; numbers: number[] };

export async function expireStaleOrders(now: Date = new Date()): Promise<ExpiryResult> {
  // Por lotes: con miles de pendientes no se cargan todos en memoria.
  const stale = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, number: true },
    take: 500,
    orderBy: { createdAt: "asc" },
  });
  if (stale.length === 0) return { expired: 0, numbers: [] };

  await db.$transaction([
    db.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { status: "CANCELLED", expiresAt: null },
    }),
    db.orderStatusHistory.createMany({
      data: stale.map((o) => ({
        orderId: o.id,
        from: "PENDING" as const,
        to: "CANCELLED" as const,
        // actorId nulo = actor `sistema`.
        note: "Expiración automática (2 h sin confirmación)",
      })),
    }),
  ]);

  return { expired: stale.length, numbers: stale.map((o) => o.number) };
}
