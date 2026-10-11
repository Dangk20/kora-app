// Política de envíos y entrega (change `centro-legal`, 10 oct 2026).
//
// Las redes de tarjetas exigen publicar la política de entrega, y con ella las
// restricciones de exportación. La regla de fondo la dio el cliente el 13 sep:
// KORA NO envía fuera de Colombia — quien compra en dólares está en el
// exterior y manda el pedido a alguien en Colombia (`shipCountry = "CO"` en
// todo pedido, ver change `direccion-facturacion-y-envio`).
//
// No se publican tiempos ni tarifas concretos: los fija la transportadora por
// destino y hoy se informan al confirmar. Un "entrega en 3 días" inventado
// sería una promesa exigible por el Estatuto del Consumidor.

import { PREVALECE_ESPANOL } from "./common";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-10";

export const envios: BilingualDocument = {
  es: (m) => ({
    slug: "envios",
    title: "Política de envíos y entrega",
    shortTitle: "Envíos y entrega",
    summary: "A dónde entregamos, cuánto tarda, cuánto cuesta y qué pasa si algo sale mal en el camino.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "destinos",
        heading: "A dónde entregamos",
        summary: "Entregamos únicamente en Colombia. No hacemos envíos internacionales.",
        blocks: [
          {
            kind: "p",
            text: "Entregamos pedidos en direcciones de Colombia, a través de compañías transportadoras. No realizamos envíos internacionales ni exportamos productos.",
          },
          {
            kind: "p",
            text: "Si compras desde el exterior —por ejemplo, pagando en dólares—, el pedido se entrega a la persona que indiques como destinatario en Colombia. En el checkout separamos tus datos de facturación (quien paga) de los datos de envío (quien recibe), y la dirección de envío siempre es colombiana.",
          },
        ],
      },
      {
        id: "tiempos",
        heading: "Tiempos de entrega",
        summary: "Preparamos el pedido al confirmarse y te avisamos por correo en cada paso.",
        blocks: [
          {
            kind: "list",
            items: [
              "Preparamos el pedido una vez confirmado: cuando se aprueba el pago con tarjeta o cuando confirmamos contigo el pago por otro medio.",
              "El tiempo de entrega depende de la ciudad de destino y de la transportadora. Te lo informamos al confirmar el pedido, antes de despacharlo.",
              "Te avisamos por correo electrónico cuando el pedido está en preparación, cuando se despacha y cuando se entrega.",
            ],
          },
          {
            kind: "note",
            text: "Los tiempos de la transportadora pueden extenderse por causas ajenas a KORA, como fechas de alta demanda, condiciones de orden público o del clima. Si eso ocurre, te avisamos.",
          },
        ],
      },
      {
        id: "costos",
        heading: "Costo del envío",
        summary: "El envío no está incluido en el precio de los productos y siempre lo conoces antes de que se cobre.",
        blocks: [
          {
            kind: "p",
            text: "El costo del envío depende del destino y del tamaño del pedido, y no está incluido en el precio de los productos. Te lo informamos y lo acordamos contigo antes de despachar: nunca se cobra un envío que no conozcas. El valor del envío no hace parte del valor del producto para efectos de cambios.",
          },
        ],
      },
      {
        id: "recepcion",
        heading: "Al recibir tu pedido",
        summary: "Revisa el paquete al recibirlo y repórtanos cualquier daño dentro del plazo.",
        blocks: [
          {
            kind: "list",
            items: [
              "Verifica que el empaque llegue cerrado y en buen estado antes de firmar la entrega.",
              "Si el paquete llega abierto, golpeado o con faltantes, déjalo anotado en la guía de la transportadora si es posible, y tómale fotografías.",
              "Reporta cualquier producto dañado o incompleto dentro del plazo de nuestra política de cambios, devoluciones y reembolsos.",
            ],
          },
          {
            kind: "p",
            text: "Si la transportadora no logra entregar por una dirección incorrecta o porque nadie recibe, nos comunicaremos contigo para coordinar un nuevo intento. Los costos de un reenvío causado por datos de entrega incorrectos corren por cuenta del comprador.",
          },
        ],
      },
      {
        id: "contacto",
        heading: "Seguimiento y contacto",
        summary: "Puedes consultar el estado de tu pedido en la tienda o escribirnos.",
        blocks: [
          {
            kind: "p",
            text: `Puedes consultar el estado de tu pedido en «Seguimiento de tu pedido», en tu cuenta, o escribirnos a ${m.email} o por WhatsApp con tu número de pedido.`,
          },
        ],
      },
    ],
  }),

  en: (m) => ({
    slug: "envios",
    title: "Shipping and Delivery Policy",
    shortTitle: "Shipping and delivery",
    summary: "Where we deliver, how long it takes, what it costs and what happens if something goes wrong on the way.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "destinos",
        heading: "Where we deliver",
        summary: "We deliver only within Colombia. We do not ship internationally.",
        blocks: [
          { kind: "p", text: "We deliver orders to addresses in Colombia through carriers. We do not ship internationally or export products." },
          {
            kind: "p",
            text: "If you buy from abroad —for example, paying in dollars—, the order is delivered to the person you designate as recipient in Colombia. At checkout we separate your billing details (who pays) from the shipping details (who receives), and the shipping address is always in Colombia.",
          },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "tiempos",
        heading: "Delivery times",
        summary: "We prepare the order once it is confirmed and email you at every step.",
        blocks: [
          {
            kind: "list",
            items: [
              "We prepare the order once it is confirmed: when the card payment is approved or when we confirm payment by another method with you.",
              "Delivery time depends on the destination city and the carrier. We tell you when we confirm the order, before shipping it.",
              "We email you when the order is being prepared, when it ships and when it is delivered.",
            ],
          },
          { kind: "note", text: "Carrier times may be extended for reasons beyond KORA's control, such as peak seasons, public order or weather conditions. If that happens, we let you know." },
        ],
      },
      {
        id: "costos",
        heading: "Shipping cost",
        summary: "Shipping is not included in product prices, and you always know it before it is charged.",
        blocks: [
          {
            kind: "p",
            text: "The shipping cost depends on the destination and the size of the order, and it is not included in product prices. We tell you the cost and agree on it with you before shipping: you are never charged for shipping you did not know about. Shipping is not part of the product's value for exchange purposes.",
          },
        ],
      },
      {
        id: "recepcion",
        heading: "When you receive your order",
        summary: "Check the package on arrival and report any damage within the deadline.",
        blocks: [
          {
            kind: "list",
            items: [
              "Check that the package arrives sealed and in good condition before signing for it.",
              "If the package arrives open, dented or with missing items, note it on the carrier's waybill if possible, and take photos.",
              "Report any damaged or incomplete product within the deadline in our exchanges, returns and refunds policy.",
            ],
          },
          {
            kind: "p",
            text: "If the carrier cannot deliver because of a wrong address or because nobody is there to receive it, we will contact you to arrange a new attempt. The cost of re-shipping caused by incorrect delivery details is borne by the buyer.",
          },
        ],
      },
      {
        id: "contacto",
        heading: "Tracking and contact",
        summary: "You can check your order status in the store or write to us.",
        blocks: [
          { kind: "p", text: `You can check your order status under "Track your order", in your account, or by writing to ${m.email} or through WhatsApp with your order number.` },
        ],
      },
    ],
  }),
};
