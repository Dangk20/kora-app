// Condiciones de venta.
//
// Describen el negocio TAL COMO OPERA. Desde el change `centro-legal` (10 oct
// 2026) hay dos vías de pago: con tarjeta, en la página alojada del
// procesador de pagos, o con otro medio coordinado por WhatsApp. Antes este
// texto decía "no cobramos en línea", que es exactamente lo contrario de lo
// que un banco espera leer en el sitio de un comercio al que habilitó cobro
// con tarjeta.
//
// Las cifras NO se escriben a mano: la vigencia del pedido sale de su módulo.
// Un número copiado a un texto legal es una promesa que deja de ser cierta el
// día que alguien cambia la constante, y nadie relee las legales.
//
// Tampoco se publican promesas que el negocio no sostiene (cuotas, compra
// protegida, envío gratis): ver ../../../../notas-tecnicas-privado.md §Tienda pública.

import { ORDER_TTL_HOURS } from "@/modules/orders/status";
import {
  cobroTarjetaEn,
  cobroTarjetaEs,
  MARCAS_EN,
  MARCAS_ES,
  MONEDAS_TARJETA_EN,
  MONEDAS_TARJETA_ES,
  PREVALECE_ESPANOL,
  presentacionEn,
  presentacionEs,
} from "./common";
import { transferenciasDe } from "../payments";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-10";

export const terminos: BilingualDocument = {
  es: (m) => ({
    slug: "terminos",
    title: "Términos y condiciones de venta",
    shortTitle: "Términos y condiciones",
    summary: "Cómo funciona comprar en KORA: el pedido, las formas de pago, los precios, las monedas y las restricciones.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "quienes-somos",
        heading: "Quiénes somos",
        summary: "KORA opera en Estados Unidos y en Colombia, con una sociedad en cada país.",
        blocks: [
          { kind: "p", text: presentacionEs(m) },
          {
            kind: "p",
            text: `Puedes contactarnos en ${m.email} o por WhatsApp desde cualquier página de la tienda. Toda la información de contacto y de registro de las dos sociedades está en la página de información del comercio.`,
          },
          {
            kind: "p",
            text: "Al hacer un pedido aceptas estas condiciones. Te recomendamos leerlas antes de comprar.",
          },
        ],
      },
      {
        id: "que-vendemos",
        heading: "Qué vendemos",
        summary: "Productos físicos nuevos de moda, belleza, infantil y accesorios, entregados en Colombia.",
        blocks: [
          {
            kind: "p",
            text: "KORA es una tienda en línea de productos físicos nuevos: ropa de mujer, hombre y niños, artículos para bebé, maquillaje y belleza, juguetes y accesorios. Cada producto tiene su ficha con fotografías, descripción, variantes disponibles (talla, color u otras) y precio.",
          },
          {
            kind: "p",
            text: "Las fotografías muestran el producto real. Los colores pueden variar ligeramente según la pantalla en que los veas.",
          },
        ],
      },
      {
        id: "pedido-y-pago",
        heading: "Cómo funciona el pedido y el pago",
        summary: "Creas el pedido y eliges cómo pagar: con tarjeta, en la página segura de nuestro procesador, o por transferencia u otro medio coordinado por WhatsApp.",
        blocks: [
          { kind: "p", text: "Eliges tus productos, los llevas al carrito y creas el pedido con tus datos de facturación y de envío. Después eliges cómo pagar:" },
          {
            kind: "list",
            items: [
              `Con tarjeta de crédito o débito (${MARCAS_ES}): te llevamos a la página de pago segura de nuestro procesador, donde escribes los datos de tu tarjeta. Cuando el pago se aprueba, tu pedido queda confirmado y te llega el comprobante por correo. Si el pago se rechaza, puedes intentarlo de nuevo o elegir otro medio.`,
              `Por transferencia o con otro medio de pago —en Colombia, ${transferenciasDe("CO", "y")}; desde Estados Unidos, ${transferenciasDe("US", "y")}—: abrimos una conversación de WhatsApp con tu número de pedido. Ahí confirmamos la disponibilidad, te damos los datos para el pago y, una vez recibido, confirmamos el pedido y te llega el comprobante por correo.`,
            ],
          },
          { kind: "p", text: cobroTarjetaEs(m) },
          {
            kind: "note",
            text: `Un pedido creado y no pagado tiene una vigencia de ${ORDER_TTL_HOURS} horas. Pasado ese tiempo se cancela automáticamente y los productos vuelven a quedar disponibles para otros compradores. Puedes volver a crearlo cuando quieras.`,
          },
          {
            kind: "p",
            text: "Crear un pedido no reserva el inventario: es una solicitud. La venta se perfecciona cuando el pago se aprueba o cuando lo confirmamos contigo.",
          },
        ],
      },
      {
        id: "disponibilidad",
        heading: "Disponibilidad de los productos",
        summary: "El inventario de la tienda en línea es el mismo de nuestro punto de venta físico.",
        blocks: [
          {
            kind: "p",
            text: "Mostramos la disponibilidad en tiempo real, pero entre que creas un pedido y se confirma puede venderse la última unidad en tienda.",
          },
          {
            kind: "p",
            text: "Si eso ocurre te lo diremos antes de cobrarte. Si ya habías pagado con tarjeta, podrás cambiar el producto o recibir el reembolso completo en la misma tarjeta.",
          },
        ],
      },
      {
        id: "precios-y-monedas",
        heading: "Precios y monedas",
        summary: `Vendemos en pesos colombianos (COP) y en dólares estadounidenses (USD). Con tarjeta se cobra en ${MONEDAS_TARJETA_ES}, en la moneda de tu pedido.`,
        blocks: [
          {
            kind: "p",
            text: "Los precios se muestran en pesos colombianos (COP) o en dólares estadounidenses (USD) según la moneda que elijas en la tienda. Todos los precios incluyen los impuestos aplicables; el costo de envío se informa aparte.",
          },
          {
            kind: "p",
            text: `El pago con tarjeta admite ${MONEDAS_TARJETA_ES}, y se cobra en la misma moneda en que creaste el pedido. Si tu tarjeta es de otro país o de otra moneda, tu banco emisor puede aplicar su propia conversión o comisiones, que no dependen de KORA.`,
          },
          {
            kind: "note",
            text: "Cada moneda tiene su propio precio, definido por nosotros. No aplicamos ninguna conversión por tasa de cambio: el precio en dólares no es el precio en pesos convertido, es un precio propio. Por eso pueden no corresponderse exactamente.",
          },
          {
            kind: "p",
            text: "Algunos productos tienen un precio especial para compra en línea, menor que el de tienda física. Cuando ocurre, lo señalamos junto al precio. El precio que aplica a tu compra es el que aparece en el pedido cuando lo creas, y queda registrado ahí aunque después cambie.",
          },
        ],
      },
      {
        id: "promociones",
        heading: "Cupones, promociones y Kora Cashback",
        summary: "Cada promoción tiene sus condiciones, publicadas en nuestra política de promociones.",
        blocks: [
          {
            kind: "p",
            text: "Las condiciones de los cupones, de las promociones vigentes y de Kora Cashback están en la política de promociones, cupones y Kora Cashback, que forma parte de estas condiciones.",
          },
        ],
      },
      {
        id: "entregas",
        heading: "Entregas",
        summary: "Entregamos únicamente en Colombia.",
        blocks: [
          {
            kind: "p",
            text: "Todo lo relativo a destinos, tiempos, costos y recepción de los pedidos está en nuestra política de envíos y entrega, que forma parte de estas condiciones.",
          },
        ],
      },
      {
        id: "restricciones",
        heading: "Restricciones legales y de exportación",
        summary: "Compras de mayores de edad, entregas solo en Colombia y sin exportación de productos.",
        blocks: [
          {
            kind: "list",
            items: [
              "Para comprar debes ser mayor de edad y tener capacidad legal para contratar. Si eres menor de edad, la compra debe hacerla tu madre, padre o representante legal.",
              "Solo entregamos en direcciones de Colombia. No exportamos productos ni realizamos envíos internacionales.",
              "Si pagas desde el exterior, el pedido se entrega a un destinatario en Colombia que tú indicas.",
            ],
          },
        ],
      },
      {
        id: "cuenta",
        heading: "Tu cuenta",
        summary: "Puedes comprar como invitado o con cuenta.",
        blocks: [
          {
            kind: "p",
            text: "La cuenta te permite consultar tu historial de pedidos, guardar direcciones y usar tu saldo de Kora Cashback.",
          },
          {
            kind: "p",
            text: "Eres responsable de mantener tu contraseña en reserva. Si crees que alguien más accedió a tu cuenta, escríbenos de inmediato.",
          },
        ],
      },
      {
        id: "cambios",
        heading: "Cambios, devoluciones y garantía",
        summary: "Tu derecho de retracto y la garantía legal se respetan siempre.",
        blocks: [
          {
            kind: "p",
            text: "Todo lo relativo a cambios de producto, reembolsos, el derecho de retracto y la garantía legal está en nuestra política de cambios, devoluciones y reembolsos, que forma parte de estas condiciones.",
          },
        ],
      },
      {
        id: "ley-aplicable",
        heading: "Ley aplicable",
        summary: "Las ventas se rigen por la ley colombiana de protección al consumidor.",
        blocks: [
          {
            kind: "p",
            text: "Los productos se venden y se entregan en Colombia, por lo que estas condiciones se rigen por la legislación colombiana, en particular por la Ley 1480 de 2011 (Estatuto del Consumidor), sin importar si pagaste en pesos o en dólares. Cualquier controversia se someterá a los jueces competentes de la República de Colombia.",
          },
          {
            kind: "p",
            text: `Si quieres presentar una petición, queja o reclamo, escríbenos a ${m.email} y te responderemos en los plazos que fija la ley.`,
          },
        ],
      },
    ],
  }),

  en: (m) => ({
    slug: "terminos",
    title: "Terms and Conditions of Sale",
    shortTitle: "Terms and conditions",
    summary: "How buying at KORA works: the order, payment options, prices, currencies and restrictions.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "quienes-somos",
        heading: "Who we are",
        summary: "KORA operates in the United States and in Colombia, with one company in each country.",
        blocks: [
          { kind: "p", text: presentacionEn(m) },
          {
            kind: "p",
            text: `You can reach us at ${m.email} or through WhatsApp from any page of the store. The full contact and registration details of both companies are on the merchant information page.`,
          },
          { kind: "p", text: "By placing an order you accept these terms. We recommend reading them before you buy." },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "que-vendemos",
        heading: "What we sell",
        summary: "New physical goods — fashion, beauty, kids and accessories — delivered in Colombia.",
        blocks: [
          {
            kind: "p",
            text: "KORA is an online store of new physical products: women's, men's and kids' clothing, baby items, makeup and beauty, toys and accessories. Each product has its own page with photos, a description, available variants (size, color or others) and its price.",
          },
          { kind: "p", text: "Photos show the actual product. Colors may vary slightly depending on your screen." },
        ],
      },
      {
        id: "pedido-y-pago",
        heading: "How ordering and payment work",
        summary: "You place the order and choose how to pay: by card, on our processor's secure page, or by bank transfer or another method arranged through WhatsApp.",
        blocks: [
          { kind: "p", text: "Choose your products, add them to the cart and place the order with your billing and shipping details. Then choose how to pay:" },
          {
            kind: "list",
            items: [
              `By credit or debit card (${MARCAS_EN}): we take you to our payment processor's secure page, where you enter your card details. When the payment is approved, your order is confirmed and you receive the receipt by email. If the payment is declined, you can try again or choose another method.`,
              `By bank transfer or another payment method —${transferenciasDe("CO", "and")} in Colombia; ${transferenciasDe("US", "and")} from the United States—: we open a WhatsApp conversation with your order number. There we confirm availability, give you the payment details and, once payment is received, confirm the order and email you the receipt.`,
            ],
          },
          { kind: "p", text: cobroTarjetaEn(m) },
          {
            kind: "note",
            text: `An order that has been placed but not paid is valid for ${ORDER_TTL_HOURS} hours. After that it is cancelled automatically and the products become available to other buyers again. You can place it again at any time.`,
          },
          { kind: "p", text: "Placing an order does not reserve inventory: it is a request. The sale is completed when the payment is approved or when we confirm it with you." },
        ],
      },
      {
        id: "disponibilidad",
        heading: "Product availability",
        summary: "The online store shares its inventory with our physical store.",
        blocks: [
          { kind: "p", text: "We show availability in real time, but between the moment you place an order and its confirmation the last unit may be sold in the store." },
          { kind: "p", text: "If that happens we will tell you before charging you. If you had already paid by card, you can switch the product or receive a full refund to the same card." },
        ],
      },
      {
        id: "precios-y-monedas",
        heading: "Prices and currencies",
        summary: `We sell in Colombian pesos (COP) and US dollars (USD). Card payments are charged in ${MONEDAS_TARJETA_EN}, in the currency of your order.`,
        blocks: [
          { kind: "p", text: "Prices are shown in Colombian pesos (COP) or US dollars (USD), depending on the currency you choose in the store. All prices include applicable taxes; shipping is shown separately." },
          {
            kind: "p",
            text: `Card payments are accepted in ${MONEDAS_TARJETA_EN} and are charged in the same currency in which you placed the order. If your card is from another country or in another currency, your issuing bank may apply its own conversion or fees, which do not depend on KORA.`,
          },
          {
            kind: "note",
            text: "Each currency has its own price, set by us. We do not apply any exchange-rate conversion: the dollar price is not the peso price converted, it is a price of its own. That is why they may not match exactly.",
          },
          {
            kind: "p",
            text: "Some products have a special online price, lower than the in-store price. When that happens we show it next to the price. The price that applies to your purchase is the one in the order when you place it, and it stays recorded there even if it changes later.",
          },
        ],
      },
      {
        id: "promociones",
        heading: "Coupons, promotions and Kora Cashback",
        summary: "Each promotion has its own terms, published in our promotions policy.",
        blocks: [
          { kind: "p", text: "The terms of coupons, current promotions and Kora Cashback are in the promotions, coupons and Kora Cashback policy, which is part of these terms." },
        ],
      },
      {
        id: "entregas",
        heading: "Delivery",
        summary: "We deliver only within Colombia.",
        blocks: [
          { kind: "p", text: "Everything about destinations, delivery times, costs and receiving orders is in our shipping and delivery policy, which is part of these terms." },
        ],
      },
      {
        id: "restricciones",
        heading: "Legal and export restrictions",
        summary: "Purchases by adults only, delivery only within Colombia and no export of products.",
        blocks: [
          {
            kind: "list",
            items: [
              "You must be of legal age and have legal capacity to enter into contracts. Minors must have a parent or legal guardian make the purchase.",
              "We deliver only to addresses in Colombia. We do not export products or ship internationally.",
              "If you pay from abroad, the order is delivered to a recipient in Colombia whom you designate.",
            ],
          },
        ],
      },
      {
        id: "cuenta",
        heading: "Your account",
        summary: "You can buy as a guest or with an account.",
        blocks: [
          { kind: "p", text: "An account lets you check your order history, save addresses and use your Kora Cashback balance." },
          { kind: "p", text: "You are responsible for keeping your password confidential. If you believe someone else accessed your account, write to us immediately." },
        ],
      },
      {
        id: "cambios",
        heading: "Exchanges, returns and warranty",
        summary: "Your right of withdrawal and the legal warranty always apply.",
        blocks: [
          { kind: "p", text: "Everything about product exchanges, refunds, the right of withdrawal and the legal warranty is in our exchanges, returns and refunds policy, which is part of these terms." },
        ],
      },
      {
        id: "ley-aplicable",
        heading: "Governing law",
        summary: "Sales are governed by Colombian consumer protection law.",
        blocks: [
          {
            kind: "p",
            text: "Products are sold and delivered in Colombia, so these terms are governed by Colombian law, in particular Law 1480 of 2011 (Consumer Protection Statute), regardless of whether you paid in pesos or dollars. Any dispute will be submitted to the competent courts of the Republic of Colombia.",
          },
          { kind: "p", text: `To submit a request, complaint or claim, write to ${m.email} and we will answer within the time limits set by law.` },
        ],
      },
    ],
  }),
};
