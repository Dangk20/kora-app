"use server";

// Operaciones del panel de pedidos (PED_HU003 §1, PED_HU004 §3/§4).
//
// `confirmOrder` es EL evento central del sistema: en una sola transacción
// descuenta stock por el motor de inventario, cambia el estado y escribe
// `order.confirmed` en la outbox. De ese evento cuelgan cliente, KoraPuntos,
// ventas y remarketing.
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@/generated/prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { applyStockMovement, StockError } from "@/modules/inventory/engine";
import { canTransition, STATUS_LABEL } from "./status";

export type OrderActionResult =
  | { ok: true }
  | { ok: false; error: string; shortages?: { sku: string; needed: number; available: number }[] };

const ADMIN_PATH = "/admin/pedidos";

function revalidate(orderId: string) {
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${orderId}`);
}

/**
 * Confirmar el pago: descuenta stock y dispara `order.confirmed`.
 *
 * Idempotente: si el pedido ya está confirmado no vuelve a descontar ni a
 * emitir el evento (PED_HU004, reglas clave).
 */
export async function confirmOrder(orderId: string): Promise<OrderActionResult> {
  const session = await requirePermission("orders:confirm");

  try {
    const shortages: { sku: string; needed: number; available: number }[] = [];

    await db.$transaction(
      async (tx) => {
        // Bloquear el pedido: dos operadores confirmando a la vez se serializan
        // y el segundo encuentra el estado ya cambiado.
        const rows = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`
          SELECT id, status FROM orders WHERE id = ${orderId} FOR UPDATE
        `;
        if (rows.length === 0) throw new Error("NOT_FOUND");
        const current = rows[0].status;
        if (current === "CONFIRMED") return; // ya confirmado: nada que hacer
        if (!canTransition(current, "CONFIRMED")) throw new Error("BAD_TRANSITION");

        const items = await tx.orderItem.findMany({
          where: { orderId },
          include: { variant: { select: { sku: true, stockActual: true } } },
        });
        if (items.length === 0) throw new Error("EMPTY");

        // Los ítems se descuentan en orden estable para evitar deadlocks entre
        // confirmaciones simultáneas con productos cruzados.
        const sorted = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
        for (const item of sorted) {
          try {
            await applyStockMovement(tx, {
              variantId: item.variantId,
              delta: -item.qty,
              reason: "VENTA_ONLINE",
              channel: "WEB",
              orderId,
              actorId: session.user.id,
              note: `Confirmación del pedido en el panel`,
            });
          } catch (e) {
            if (e instanceof StockError) {
              shortages.push({
                sku: item.sku,
                needed: item.qty,
                available: e.available ?? item.variant.stockActual,
              });
              throw new Error("INSUFFICIENT_STOCK");
            }
            throw e;
          }
        }

        const order = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: session.user.id,
            expiresAt: null, // ya no expira
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            from: current,
            to: "CONFIRMED",
            actorId: session.user.id,
            note: "Pago confirmado en el panel",
          },
        });

        // Outbox: el evento se escribe en la MISMA transacción, así que no
        // puede existir un pedido confirmado sin su evento, ni al revés.
        await tx.domainEvent.create({
          data: {
            type: "order.confirmed",
            payload: {
              orderId,
              orderNumber: order.number,
              customerId: order.customerId,
              currency: order.currency,
              total: order.total.toString(),
              confirmedAt: new Date().toISOString(),
              confirmedById: session.user.id,
            },
          },
        });
      },
      { timeout: 30_000, maxWait: 30_000 },
    );

    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "INSUFFICIENT_STOCK") {
      return {
        ok: false,
        error:
          "Stock insuficiente para confirmar. No se descontó nada; resuélvelo con el comprador.",
      };
    }
    if (message === "NOT_FOUND") return { ok: false, error: "El pedido no existe" };
    if (message === "EMPTY") return { ok: false, error: "El pedido no tiene ítems" };
    if (message === "BAD_TRANSITION") {
      return { ok: false, error: "El pedido ya no está pendiente" };
    }
    return { ok: false, error: "No se pudo confirmar el pedido. Intenta de nuevo." };
  }
}

/**
 * Confirmación con el detalle de qué faltó. Se separa de `confirmOrder`
 * porque la transacción hace rollback y pierde lo acumulado dentro.
 */
export async function checkStockForOrder(
  orderId: string,
): Promise<{ sku: string; productName: string; needed: number; available: number }[]> {
  await requirePermission("orders:view");
  const items = await db.orderItem.findMany({
    where: { orderId },
    include: { variant: { select: { stockActual: true } } },
  });
  return items
    .filter((i) => i.variant.stockActual < i.qty)
    .map((i) => ({
      sku: i.sku,
      productName: i.productName,
      needed: i.qty,
      available: i.variant.stockActual,
    }));
}

/** Avanza el pedido al siguiente estado del flujo (preparación, envío…). */
export async function advanceOrderStatus(
  orderId: string,
  to: OrderStatus,
): Promise<OrderActionResult> {
  const session = await requirePermission("orders:edit");

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return { ok: false, error: "El pedido no existe" };
  if (!canTransition(order.status, to)) {
    return {
      ok: false,
      error: `Transición no permitida: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}`,
    };
  }

  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status: to } }),
    db.orderStatusHistory.create({
      data: { orderId, from: order.status, to, actorId: session.user.id },
    }),
  ]);

  revalidate(orderId);
  return { ok: true };
}

/** Cancela con motivo obligatorio (PED_HU004 §4). No toca stock. */
export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<OrderActionResult> {
  const session = await requirePermission("orders:cancel");
  const motivo = reason?.trim();
  if (!motivo || motivo.length < 3) {
    return { ok: false, error: "Escribe el motivo de la cancelación" };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return { ok: false, error: "El pedido no existe" };
  if (!canTransition(order.status, "CANCELLED")) {
    return {
      ok: false,
      error: `No se puede cancelar un pedido en estado ${STATUS_LABEL[order.status]}`,
    };
  }

  // Cancelar un pedido ya confirmado NO devuelve el stock automáticamente:
  // la mercancía pudo haber salido. El operador lo ajusta desde Inventario,
  // que deja el movimiento con su motivo en el kardex.
  await db.$transaction([
    db.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", expiresAt: null },
    }),
    db.orderStatusHistory.create({
      data: {
        orderId,
        from: order.status,
        to: "CANCELLED",
        actorId: session.user.id,
        note: motivo,
      },
    }),
  ]);

  revalidate(orderId);
  return { ok: true };
}

/** Reabre un pedido cancelado devolviéndolo a Pendiente (PED_HU003 §2). */
export async function reopenOrder(orderId: string): Promise<OrderActionResult> {
  const session = await requirePermission("orders:edit");

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return { ok: false, error: "El pedido no existe" };
  if (order.status !== "CANCELLED") {
    return { ok: false, error: "Solo se reabren pedidos cancelados" };
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await db.$transaction([
    db.order.update({
      where: { id: orderId },
      data: { status: "PENDING", expiresAt },
    }),
    db.orderStatusHistory.create({
      data: {
        orderId,
        from: "CANCELLED",
        to: "PENDING",
        actorId: session.user.id,
        note: "Pedido reabierto desde el panel",
      },
    }),
  ]);

  revalidate(orderId);
  return { ok: true };
}
