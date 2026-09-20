// Qué dice un comprobante de pedido, congelado en el momento de emitirse.
//
// El pedido ya guarda su propio snapshot: lo que se cobró. Este va un paso más
// allá y congela además QUIÉN lo cobró y A NOMBRE DE QUIÉN — que es lo que un
// documento de respaldo tiene que sostener años después, cuando el catálogo
// cambió, el comprador se mudó y el comerciante actualizó su domicilio.
//
// Los importes viajan como CADENAS, no como números. Aquí no se calcula nada
// —todos vienen del pedido, ya decididos— y una cadena reproduce el decimal
// exacto que se cobró. Convertirlos a coma flotante para guardarlos solo
// añadiría una oportunidad de que $1.234.567 se vuelva otra cosa.

import type { Currency, SaleChannel } from "@/generated/prisma/enums";
import { merchant } from "@/modules/legal/config";
import { formatOrderNumber } from "@/modules/orders/message";

/** Sube de 1 solo si cambia la FORMA del snapshot, no su contenido. */
/**
 * 1 = una sola dirección (hasta el 19 sep 2026).
 * 2 = facturación y envío por separado, con `sameAddress` (change
 *     direccion-facturacion-y-envio). Un snapshot v1 se sigue dibujando
 *     exactamente como se emitió: está congelado.
 */
export const SNAPSHOT_VERSION = 2;

export type SalesDocumentSnapshot = {
  version: number;

  /** Quién emite. Copiado, no leído: si mañana cambia el NIT, este no cambia. */
  merchant: {
    razonSocial: string;
    nit: string;
    domicilio: string;
    email: string;
  };

  /** A nombre de quién. Del PEDIDO, no de la ficha del cliente. */
  buyer: {
    name: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
  };

  /**
   * Dirección de FACTURACIÓN: la de quien paga (v2). Nula en snapshots v1 y
   * en venta de mostrador. No va al chat de WhatsApp; es dato del comprobante,
   * del panel y —el día que exista pasarela— de la validación de la tarjeta.
   */
  billing?: {
    country: string | null;
    state: string | null;
    city: string | null;
    address: string | null;
    address2: string | null;
    neighborhood: string | null;
    zip: string | null;
  } | null;

  /** true = la entrega es a la misma persona y dirección que la facturación (v2). */
  sameAddress?: boolean;

  /** A dónde se envió. Nulo en venta de mostrador. */
  shipping: {
    /** Quien recibe (v2). Antes era siempre el comprador. */
    name?: string | null;
    phone?: string | null;
    document?: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address: string | null;
    address2: string | null;
    neighborhood: string | null;
    zip: string | null;
    notes: string | null;
  } | null;

  lines: {
    sku: string;
    productName: string;
    variantName: string;
    qty: number;
    unitPrice: string;
    total: string;
  }[];

  totals: {
    subtotal: string;
    discount: string;
    /** Pagado con saldo de Kora Cashback. Es dinero que el comprador NO puso. */
    cashbackApplied: string;
    /** Lo que efectivamente se cobró. */
    total: string;
  };

  currency: Currency;
  channel: SaleChannel;
  orderNumber: number;
  /**
   * El código humano tal como lo enseña el panel: `KO-2026-07943`.
   *
   * Se congela en vez de derivarse al renderizar, porque lo decide el año de
   * CREACIÓN del pedido, no el de su confirmación. Un pedido creado el 31 de
   * diciembre y confirmado el 1 de enero se enseñaría en el panel con un año y
   * en su comprobante con otro: dos códigos para una misma compra, y ninguna
   * pantalla dando error.
   */
  orderCode: string;
  /** Cuándo se confirmó el pedido, en ISO. */
  issuedAt: string;
  /** "Nequi", "Zelle"… tal como se acordó. Puede no haberse registrado. */
  paymentPreference: string | null;
  note: string | null;
};

/** La forma mínima que este módulo necesita de un pedido para congelarlo. */
export type OrderParaComprobante = {
  number: number;
  createdAt: Date;
  currency: Currency;
  channel: SaleChannel;
  subtotal: { toString(): string };
  discountTotal: { toString(): string };
  cashbackApplied: { toString(): string };
  total: { toString(): string };
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactDocument: string | null;
  billCountry: string | null;
  billState: string | null;
  billCity: string | null;
  billAddress: string | null;
  billAddress2: string | null;
  billNeighborhood: string | null;
  billZip: string | null;
  shipSameAsBilling: boolean;
  shipName: string | null;
  shipPhone: string | null;
  shipDocument: string | null;
  shipCountry: string | null;
  shipState: string | null;
  shipCity: string | null;
  shipAddress: string | null;
  shipAddress2: string | null;
  shipNeighborhood: string | null;
  shipZip: string | null;
  shipNotes: string | null;
  paymentPreference: string | null;
  note: string | null;
  items: {
    sku: string;
    productName: string;
    variantName: string;
    qty: number;
    unitPrice: { toString(): string };
    total: { toString(): string };
  }[];
};

export function buildSnapshot(
  order: OrderParaComprobante,
  issuedAt: Date,
  env: NodeJS.ProcessEnv = process.env,
): SalesDocumentSnapshot {
  const m = merchant(env);

  // Sin dirección de envío no se inventa una sección vacía: el documento
  // simplemente no la lleva. Una tarjeta "Enviar a: — — —" es ruido que
  // parece un dato perdido.
  const hayEnvio = Boolean(order.shipAddress || order.shipCity);
  const hayFacturacion = Boolean(order.billAddress || order.billCity);

  return {
    version: SNAPSHOT_VERSION,
    merchant: {
      razonSocial: m.razonSocial,
      nit: m.nit,
      domicilio: m.domicilio,
      email: m.email,
    },
    buyer: {
      name: order.contactName,
      document: order.contactDocument,
      email: order.contactEmail,
      phone: order.contactPhone,
    },
    billing: hayFacturacion
      ? {
          country: order.billCountry,
          state: order.billState,
          city: order.billCity,
          address: order.billAddress,
          address2: order.billAddress2,
          neighborhood: order.billNeighborhood,
          zip: order.billZip,
        }
      : null,
    sameAddress: order.shipSameAsBilling,
    shipping: hayEnvio
      ? {
          name: order.shipName,
          phone: order.shipPhone,
          document: order.shipDocument,
          country: order.shipCountry,
          state: order.shipState,
          city: order.shipCity,
          address: order.shipAddress,
          address2: order.shipAddress2,
          neighborhood: order.shipNeighborhood,
          zip: order.shipZip,
          notes: order.shipNotes,
        }
      : null,
    lines: order.items.map((i) => ({
      sku: i.sku,
      productName: i.productName,
      variantName: i.variantName,
      qty: i.qty,
      unitPrice: i.unitPrice.toString(),
      total: i.total.toString(),
    })),
    totals: {
      subtotal: order.subtotal.toString(),
      discount: order.discountTotal.toString(),
      cashbackApplied: order.cashbackApplied.toString(),
      total: order.total.toString(),
    },
    currency: order.currency,
    channel: order.channel,
    orderNumber: order.number,
    orderCode: formatOrderNumber(order.number, order.createdAt),
    issuedAt: issuedAt.toISOString(),
    paymentPreference: order.paymentPreference,
    note: order.note,
  };
}

/** Los campos que `buildSnapshot` necesita, para pedírselos a Prisma. */
export const SELECT_PARA_COMPROBANTE = {
  number: true,
  createdAt: true,
  currency: true,
  channel: true,
  subtotal: true,
  discountTotal: true,
  cashbackApplied: true,
  total: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  contactDocument: true,
  billCountry: true,
  billState: true,
  billCity: true,
  billAddress: true,
  billAddress2: true,
  billNeighborhood: true,
  billZip: true,
  shipSameAsBilling: true,
  shipName: true,
  shipPhone: true,
  shipDocument: true,
  shipCountry: true,
  shipState: true,
  shipCity: true,
  shipAddress: true,
  shipAddress2: true,
  shipNeighborhood: true,
  shipZip: true,
  shipNotes: true,
  paymentPreference: true,
  note: true,
  confirmedAt: true,
  items: {
    select: {
      sku: true,
      productName: true,
      variantName: true,
      qty: true,
      unitPrice: true,
      total: true,
    },
  },
} as const;
