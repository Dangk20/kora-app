// Reúne lo que un correo del pedido necesita saber.
// Ver openspec/changes/correos-transaccionales — design.md §4.

import { db } from "@/lib/db";
import { aNumero } from "@/modules/cashback/money";
import { storage } from "@/modules/storage";
import { formatOrderNumber, whatsappUrl } from "@/modules/orders/message";
import { whatsappNumberFor } from "@/modules/orders/settings";
import type { OrderEmailData } from "./render";

export type OrderEmailContext = OrderEmailData & {
  /** Dirección del comprador SEGÚN EL PEDIDO, no según la ficha del cliente. */
  buyerEmail: string | null;
};

/**
 * Todo lo que hace falta para redactar cualquiera de los correos del pedido.
 *
 * El destinatario sale de `contactEmail` del PEDIDO y no del cliente: el
 * pedido guarda su propio snapshot del comprador a propósito — si el cliente
 * cambia de correo después, el pedido despachado conserva el suyo. El correo
 * pertenece a ese pedido, no a la ficha del cliente en su estado de hoy.
 */
export async function orderEmailContext(orderId: string): Promise<OrderEmailContext | null> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: {
      // La primera foto de cada producto, para la tabla del correo.
      items: {
        include: {
          variant: {
            select: {
              product: { select: { images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } },
            },
          },
        },
      },
      cashbackMovements: { select: { delta: true, type: true, expiresAt: true } },
    },
  });
  if (!o) return null;

  const acreditado = o.cashbackMovements.find((m) => m.type === "EARN");
  const devuelto = o.cashbackMovements
    .filter((m) => m.type === "ADJUST" && aNumero(m.delta) > 0)
    .reduce((s, m) => s + aNumero(m.delta), 0);

  const numero = formatOrderNumber(o.number, o.createdAt);

  return {
    orderId: o.id,
    orderNumber: numero,
    buyerName: o.contactName,
    buyerEmail: o.contactEmail,
    shipTo: o.shipSameAsBilling ? null : { name: o.shipName, city: o.shipCity },
    whatsappUrl: o.whatsappMessage
      ? whatsappUrl(await whatsappNumberFor(o.currency), o.whatsappMessage)
      : null,
    cashbackEarned: acreditado ? aNumero(acreditado.delta) : 0,
    cashbackExpiresAt: acreditado?.expiresAt ?? null,
    cashbackRefunded: devuelto,
    order: {
      number: numero,
      currency: o.currency,
      lines: o.items.map((i) => ({
        qty: i.qty,
        name: i.productName,
        variant: i.variantName,
        total: aNumero(i.total),
        imageUrl: i.variant.product.images[0] ? storage().urlFor(i.variant.product.images[0].url) : null,
      })),
      subtotal: aNumero(o.subtotal),
      discountTotal: aNumero(o.discountTotal),
      cashbackApplied: aNumero(o.cashbackApplied),
      total: aNumero(o.total),
    },
  };
}
