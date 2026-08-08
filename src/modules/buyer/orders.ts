// Los pedidos del comprador, vistos desde su cuenta.
// Ver openspec/changes/cuenta-comprador — specs/buyer-account.
//
// Toda consulta parte del cliente de la SESIÓN. El número del pedido nunca es
// la clave de la búsqueda: es un filtro que se aplica DESPUÉS de acotar a lo
// del comprador. Buscar por número y comprobar después el dueño funciona
// igual… hasta que alguien olvide la comprobación.

import type { Currency, OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { computeAccrual } from "@/modules/cashback/accrual";
import { aNumero } from "@/modules/cashback/money";

export type BuyerOrderRow = {
  id: string;
  number: number;
  createdAt: Date;
  status: OrderStatus;
  currency: Currency;
  total: number;
  /** Cashback del pedido: lo acreditado, o la estimación si aún no ocurrió. */
  cashback: number;
  /**
   * `acreditado` = está en el libro. `estimado` = todavía no, se enseña en
   * futuro. `ninguno` = no va a generar (cancelado o vencido) y no se enseña.
   */
  cashbackEstado: "acreditado" | "estimado" | "ninguno";
  items: number;
};

/** Un pedido pendiente sigue vivo mientras no venza su vigencia de 2 h. */
export function estaVigente(o: { status: OrderStatus; expiresAt: Date | null }, now = new Date()) {
  return o.status === "PENDING" && (o.expiresAt === null || o.expiresAt > now);
}

/**
 * Un pedido cancelado no genera cashback, ni ahora ni nunca.
 *
 * No hay estado "vencido": un pendiente que pasó su vigencia se detecta por
 * `expiresAt`, y lo resuelve la comprobación de abajo.
 */
const SIN_CASHBACK: OrderStatus[] = ["CANCELLED"];

/**
 * Qué decirle al comprador sobre el cashback de un pedido.
 *
 * **"Generó" se dice SOLO si está en el libro.** Antes, un pedido confirmado
 * sin movimiento caía en "Generó" con el 3 % calculado: la pantalla prometía
 * un dinero que el libro no tenía, el comprador iba a su saldo y encontraba
 * cero. Le pasó a un pedido entregado, y el fallo no daba ningún error — que
 * es exactamente lo que lo hace peligroso.
 *
 * El cálculo se sigue enseñando, pero **en futuro y como estimación**, que es
 * lo único que se puede prometer antes de que el evento se procese.
 */
export function estadoCashback(
  o: { status: OrderStatus; expiresAt: Date | null },
  acreditado: boolean,
  now = new Date(),
): "acreditado" | "estimado" | "ninguno" {
  if (acreditado) return "acreditado";
  if (SIN_CASHBACK.includes(o.status)) return "ninguno";
  // Un pendiente ya vencido tampoco va a generar nada, aunque el trabajo que
  // lo marca como vencido no haya pasado todavía.
  if (o.status === "PENDING" && !estaVigente(o, now)) return "ninguno";
  return "estimado";
}

export async function buyerOrders(customerId: string, now = new Date()): Promise<BuyerOrderRow[]> {
  const pedidos = await db.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      cashbackMovements: { where: { type: "EARN" }, select: { delta: true } },
    },
  });

  return pedidos.map((o) => {
    const acreditado = o.cashbackMovements[0];
    const total = aNumero(o.total);
    return {
      id: o.id,
      number: o.number,
      createdAt: o.createdAt,
      status: o.status,
      currency: o.currency,
      total,
      // Si ya se acreditó, se muestra lo que REALMENTE entró al libro, no un
      // cálculo repetido: si algún día divergieran, lo que vale es el libro.
      cashback: acreditado ? aNumero(acreditado.delta) : computeAccrual({ total, currency: o.currency }),
      cashbackEstado: estadoCashback(o, Boolean(acreditado), now),
      items: o._count.items,
    };
  });
}

export type BuyerOrderDetail = NonNullable<Awaited<ReturnType<typeof buyerOrder>>>;

/**
 * El detalle de UN pedido del comprador.
 *
 * `customerId` va en el `where`, no en una comprobación posterior: un pedido
 * de otra persona simplemente no existe para esta consulta. Es la diferencia
 * entre que la cuenta sea privada y que parezca privada.
 */
export async function buyerOrder(customerId: string, number: number) {
  const o = await db.order.findFirst({
    where: { customerId, number },
    include: {
      items: true,
      cashbackMovements: { where: { type: "EARN" }, select: { delta: true, expiresAt: true } },
    },
  });
  if (!o) return null;

  const total = aNumero(o.total);
  const acreditado = o.cashbackMovements[0];

  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    currency: o.currency,
    subtotal: aNumero(o.subtotal),
    discountTotal: aNumero(o.discountTotal),
    cashbackApplied: aNumero(o.cashbackApplied),
    total,
    expiresAt: o.expiresAt,
    vigente: estaVigente(o),
    whatsappMessage: o.whatsappMessage,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    shipAddress: o.shipAddress,
    shipCity: o.shipCity,
    cashback: acreditado ? aNumero(acreditado.delta) : computeAccrual({ total, currency: o.currency }),
    cashbackAcreditado: Boolean(acreditado),
    cashbackEstado: estadoCashback(o, Boolean(acreditado)),
    cashbackVence: acreditado?.expiresAt ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      qty: i.qty,
      unitPrice: aNumero(i.unitPrice),
      total: aNumero(i.total),
    })),
  };
}
