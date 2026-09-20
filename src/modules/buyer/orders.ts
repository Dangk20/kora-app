// Los pedidos del comprador, vistos desde su cuenta.
// Ver openspec/changes/cuenta-comprador — specs/buyer-account.
//
// Toda consulta parte del cliente de la SESIÓN. El número del pedido nunca es
// la clave de la búsqueda: es un filtro que se aplica DESPUÉS de acotar a lo
// del comprador. Buscar por número y comprobar después el dueño funciona
// igual… hasta que alguien olvide la comprobación.

import { Prisma } from "@/generated/prisma/client";
import type { Currency, OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { storage } from "@/modules/storage";
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
  /** Lo que se compró, con foto: la tarjeta de la lista lo enseña. */
  lineas: { productName: string; variantName: string; qty: number; imageUrl: string | null }[];
  /** Cuándo entró en su estado actual — "Entregado el 27 de agosto". */
  statusAt: Date;
};

/** Un pedido pendiente sigue vivo mientras no venza su vigencia (ORDER_TTL_HOURS). */
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
      items: { include: { variant: { select: { product: { select: { images: IMAGEN_PORTADA } } } } } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  return pedidos.map((o) => {
    const acreditado = o.cashbackMovements[0];
    const total = aNumero(o.total);
    return {
      lineas: o.items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        qty: i.qty,
        imageUrl: portada(i.variant.product.images),
      })),
      statusAt: o.statusHistory[0]?.createdAt ?? o.createdAt,
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
    include: DETALLE_INCLUDE,
  });
  return o ? detalleDelPedido(o) : null;
}

/**
 * El mismo detalle, buscado por identificador y SIN acotar a un cliente.
 *
 * La usa el seguimiento público (`modules/orders/tracking.ts`), donde el
 * derecho a ver el pedido ya se demostró de otra forma: con el número más el
 * contacto del propio pedido, y después con un token firmado.
 *
 * Va aquí, y no reimplementada allí, porque lo que no puede divergir es QUÉ se
 * le enseña al comprador sobre su pedido. Dos mapeos separados se separan más
 * con cada cambio, y el que se olvide será el que un invitado ve.
 */
export async function orderDetailById(orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: DETALLE_INCLUDE,
  });
  return o ? detalleDelPedido(o) : null;
}

/**
 * Lo que las dos consultas traen. Una sola definición del `include`: si las
 * dos lo escribieran por su cuenta, una podría dejar de traer los movimientos
 * de cashback y la pantalla enseñaría una estimación donde hay un dato real.
 */
/** La primera foto del producto, ya resuelta a su dirección pública. */
const IMAGEN_PORTADA = { orderBy: { position: "asc" as const }, take: 1, select: { url: true } };
function portada(imgs: { url: string }[]): string | null {
  return imgs[0] ? storage().urlFor(imgs[0].url) : null;
}

const DETALLE_INCLUDE = {
  items: { include: { variant: { select: { product: { select: { slug: true, images: IMAGEN_PORTADA } } } } } },
  cashbackMovements: {
    where: { type: "EARN" as const },
    select: { delta: true, expiresAt: true },
  },
  // El recorrido del pedido, para la línea de tiempo: cada cambio de estado
  // con su fecha real. Las notas del sistema ("outbox procesado") se quedan
  // fuera: el comprador quiere saber cuándo se confirmó, no qué hizo el worker.
  statusHistory: { orderBy: { createdAt: "asc" as const }, select: { from: true, to: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

type PedidoConDetalle = Prisma.OrderGetPayload<{ include: typeof DETALLE_INCLUDE }>;

function detalleDelPedido(o: PedidoConDetalle) {

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
    // Quien recibe, cuando no es quien pagó (change direccion-facturacion-y-envio).
    shipSameAsBilling: o.shipSameAsBilling,
    shipName: o.shipName,
    shipPhone: o.shipPhone,
    shipAddress: o.shipAddress,
    shipAddress2: o.shipAddress2,
    shipNeighborhood: o.shipNeighborhood,
    shipCity: o.shipCity,
    shipState: o.shipState,
    shipCountry: o.shipCountry,
    shipNotes: o.shipNotes,
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
      imageUrl: portada(i.variant.product.images),
      slug: i.variant.product.slug,
    })),
    /** Cuándo entró el pedido en cada estado, por estado. Solo transiciones reales. */
    estadoEn: Object.fromEntries(
      o.statusHistory.filter((h) => h.from !== h.to).map((h) => [h.to, h.createdAt]),
    ) as Partial<Record<OrderStatus, Date>>,
  };
}

/** Con qué facturó la última vez: para no hacerle escribir su dirección otra vez. */
export type UltimaFacturacion = {
  country: "CO" | "US";
  state: string;
  city: string;
  address: string;
  address2: string;
  neighborhood: string;
  zip: string;
  document: string;
};

/**
 * La facturación del pedido más reciente del comprador, para precargar el
 * bloque "Quién paga" del checkout.
 *
 * Es una LECTURA del último pedido, a propósito, y no una columna en el
 * cliente: `customer.city/address` ya es un espejo de la libreta con un solo
 * escritor, y un segundo espejo para la facturación sería otra forma de
 * desincronizarse sin dar error. El pedido es el snapshot; se lee de ahí.
 */
export async function ultimaFacturacion(customerId: string): Promise<UltimaFacturacion | null> {
  const o = await db.order.findFirst({
    where: { customerId, billAddress: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      billCountry: true,
      billState: true,
      billCity: true,
      billAddress: true,
      billAddress2: true,
      billNeighborhood: true,
      billZip: true,
      contactDocument: true,
    },
  });
  if (!o?.billAddress) return null;
  return {
    country: o.billCountry === "US" ? "US" : "CO",
    state: o.billState ?? "",
    city: o.billCity ?? "",
    address: o.billAddress,
    address2: o.billAddress2 ?? "",
    neighborhood: o.billNeighborhood ?? "",
    zip: o.billZip ?? "",
    // El pedido guarda "CC 1020304050"; el formulario pide solo el número.
    document: (o.contactDocument ?? "").replace(/^[A-Z]+\s+/, ""),
  };
}
