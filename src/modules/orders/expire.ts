// Expiración automática de pedidos pendientes (PED_HU003 §2).
//
// Un pedido creado en la tienda vive 2 horas; si nadie confirma el pago en
// ese lapso se cancela solo, con actor `sistema`. Sin efecto en inventario:
// el stock nunca se descontó (no hay reserva).
//
// El cashback SÍ se devuelve, y es la asimetría a propósito: el stock nunca
// salió del pool, pero el saldo sí salió del bolsillo del comprador al crear
// el pedido. Dejárselo perdido por una compra que nunca ocurrió sería
// quedarse con su dinero.
import { db } from "@/lib/db";
import { refundOrderCashback } from "@/modules/cashback/refund";

export type ExpiryResult = { expired: number; numbers: number[] };

export async function expireStaleOrders(now: Date = new Date()): Promise<ExpiryResult> {
  // Por lotes: con miles de pendientes no se cargan todos en memoria.
  const stale = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, number: true, cashbackApplied: true },
    take: 500,
    orderBy: { createdAt: "asc" },
  });
  if (stale.length === 0) return { expired: 0, numbers: [] };

  await db.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { status: "CANCELLED", expiresAt: null },
    });
    await tx.orderStatusHistory.createMany({
      data: stale.map((o) => ({
        orderId: o.id,
        from: "PENDING" as const,
        to: "CANCELLED" as const,
        // actorId nulo = actor `sistema`.
        note: "Expiración automática (2 h sin confirmación)",
      })),
    });
    // Uno por uno: cada devolución bloquea la fila de SU cliente, y el
    // recorrido es sobre pedidos que aplicaron saldo, que son pocos.
    for (const o of stale) {
      if (Number(o.cashbackApplied) <= 0) continue;
      await refundOrderCashback(tx, o.id);
    }

    // El aviso al comprador cuelga de la bandeja, en la MISMA transacción que
    // la cancelación: o se cancela y se avisa, o no pasa ninguna de las dos.
    await tx.domainEvent.createMany({
      data: stale.map((o) => ({
        type: "order.cancelled",
        payload: { orderId: o.id, reason: "EXPIRED" },
      })),
    });
  });

  return { expired: stale.length, numbers: stale.map((o) => o.number) };
}
