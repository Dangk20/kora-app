// Condiciones de venta.
//
// Describen el negocio TAL COMO OPERA, no uno genérico. Lo importante y poco
// habitual: esta plataforma NO procesa pagos. El comprador crea un pedido, el
// cobro se coordina por WhatsApp y el operador confirma. Decir otra cosa —o
// callarlo— haría que el comprador esperara un checkout con tarjeta que no
// existe.
//
// Las cifras NO se escriben a mano: la vigencia del pedido, la tasa de cashback
// y la vigencia de los lotes se importan de sus módulos. Un número copiado a un
// texto legal es una promesa que deja de ser cierta el día que alguien cambia
// la constante, y nadie relee las legales.
//
// Tampoco se publican promesas que el negocio no sostiene (cuotas, compra
// protegida, envío gratis): misma decisión ya tomada para la tienda pública,
// ver ../../../../notas-tecnicas-privado.md §Tienda pública.

import { ORDER_TTL_HOURS } from "@/modules/orders/status";
import { TASA_CASHBACK, VIGENCIA_MESES } from "@/modules/cashback/money";
import type { LegalDocumentFactory } from "./types";

const PORCENTAJE_CASHBACK = `${Math.round(TASA_CASHBACK * 100)} %`;

export const terminos: LegalDocumentFactory = (m) => ({
  slug: "terminos",
  title: "Términos y condiciones de venta",
  summary:
    "Cómo funciona comprar en KORA: el pedido, el pago por WhatsApp, los precios y el cashback.",
  updatedAt: "2026-08-07",
  sections: [
    {
      heading: "Quiénes somos",
      blocks: [
        {
          kind: "p",
          text: `Esta tienda es operada por ${m.razonSocial}, NIT ${m.nit}, con domicilio en ${m.domicilio}. Puedes contactarnos en ${m.email} o por WhatsApp desde cualquier página de la tienda.`,
        },
        {
          kind: "p",
          text: "Al hacer un pedido aceptas estas condiciones. Te recomendamos leerlas antes de comprar; son cortas a propósito.",
        },
      ],
    },
    {
      heading: "Cómo funciona el pedido: no cobramos en línea",
      blocks: [
        {
          kind: "p",
          text: "KORA no tiene pasarela de pago. En esta tienda no se ingresan datos de tarjeta ni se realiza ningún cobro.",
        },
        {
          kind: "list",
          items: [
            "Eliges tus productos y creas el pedido desde el carrito.",
            "El sistema te entrega un número de pedido y abre una conversación de WhatsApp con nosotros.",
            "Por WhatsApp confirmamos la disponibilidad, acordamos el medio de pago y coordinamos la entrega.",
            "Cuando el pago queda acordado, marcamos el pedido como confirmado y te llega el comprobante por correo.",
          ],
        },
        {
          kind: "note",
          text: `Un pedido creado y no confirmado tiene una vigencia de ${ORDER_TTL_HOURS} horas. Pasado ese tiempo se cancela automáticamente y los productos vuelven a quedar disponibles para otros compradores. Puedes volver a crearlo cuando quieras.`,
        },
        {
          kind: "p",
          text: "Crear un pedido no reserva el inventario ni constituye una venta cerrada: es una solicitud. La venta se perfecciona cuando confirmamos el pedido y acordamos el pago contigo.",
        },
      ],
    },
    {
      heading: "Disponibilidad de los productos",
      blocks: [
        {
          kind: "p",
          text: "El inventario que ves en la tienda es el mismo que atiende nuestro punto de venta físico. Mostramos la disponibilidad en tiempo real, pero entre que creas un pedido y lo confirmamos puede venderse la última unidad en tienda.",
        },
        {
          kind: "p",
          text: "Si eso ocurre te lo diremos por WhatsApp antes de cobrarte, y podrás cambiar el producto o cancelar el pedido sin costo.",
        },
      ],
    },
    {
      heading: "Precios y monedas",
      blocks: [
        {
          kind: "p",
          text: "Los precios se muestran en pesos colombianos (COP) o en dólares estadounidenses (USD) según la moneda que elijas en la tienda.",
        },
        {
          kind: "note",
          text: "Cada moneda tiene su propio precio, definido por nosotros. No aplicamos ninguna conversión por tasa de cambio: el precio en dólares no es el precio en pesos convertido, es un precio propio. Por eso pueden no corresponderse exactamente.",
        },
        {
          kind: "p",
          text: "Algunos productos tienen un precio especial para compra en línea, menor que el de tienda física. Cuando ocurre, lo señalamos junto al precio. El precio que aplica a tu compra es el que aparece en el pedido cuando lo creas, y queda registrado ahí aunque después cambie.",
        },
        {
          kind: "p",
          text: "Los precios pueden cambiar en cualquier momento sin aviso previo, pero nunca afectan un pedido ya creado.",
        },
      ],
    },
    {
      heading: "Cupones y descuentos",
      blocks: [
        {
          kind: "p",
          text: "Los cupones tienen sus propias condiciones: fecha de vigencia, número máximo de usos, monto mínimo de compra y productos o categorías donde aplican. Esas condiciones se validan al crear el pedido.",
        },
        {
          kind: "p",
          text: "No es posible combinar un cupón con el pago usando saldo de Kora Cashback en la misma compra.",
        },
      ],
    },
    {
      heading: "Kora Cashback",
      blocks: [
        {
          kind: "p",
          text: `Con cada compra confirmada acumulas el ${PORCENTAJE_CASHBACK} del valor que efectivamente pagaste con dinero, después de descontar cupones y el propio saldo de cashback que hayas usado. Ese saldo lo puedes usar como descuento en tu próxima compra.`,
        },
        {
          kind: "list",
          items: [
            `El saldo se acredita cuando confirmamos tu pedido, no cuando lo creas.`,
            `Cada acreditación tiene una vigencia de ${VIGENCIA_MESES} meses. Al usarlo se consume primero el saldo más próximo a vencer.`,
            "El saldo en pesos y el saldo en dólares son independientes: no se suman entre sí ni se convierten el uno en el otro.",
            "Para acumular y usar cashback necesitas tener cuenta en la tienda y estar con la sesión iniciada al momento de comprar.",
            "El saldo es personal e intransferible, y no es canjeable por dinero en efectivo.",
          ],
        },
        {
          kind: "note",
          text: "Si usas saldo en un pedido y ese pedido se cancela o vence, el saldo vuelve a tu cuenta con la misma fecha de vencimiento que tenía. Cancelar un pedido no renueva la vigencia de un cashback por vencer.",
        },
      ],
    },
    {
      heading: "Entregas",
      blocks: [
        {
          kind: "p",
          text: "Las condiciones, tiempos y costos de entrega se acuerdan contigo por WhatsApp al confirmar el pedido, según tu ubicación y el producto.",
        },
      ],
    },
    {
      heading: "Tu cuenta",
      blocks: [
        {
          kind: "p",
          text: "Puedes comprar como invitado o crear una cuenta. La cuenta te permite consultar tu historial de pedidos y tu saldo de Kora Cashback.",
        },
        {
          kind: "p",
          text: "Eres responsable de mantener tu contraseña en reserva. Si crees que alguien más accedió a tu cuenta, escríbenos de inmediato.",
        },
      ],
    },
    {
      heading: "Cambios, retracto y garantía",
      blocks: [
        {
          kind: "p",
          text: "Todo lo relativo a cambios de producto, al derecho de retracto y a la garantía legal está en nuestra política de cambios, que forma parte de estas condiciones.",
        },
      ],
    },
    {
      heading: "Ley aplicable",
      blocks: [
        {
          kind: "p",
          text: "Estas condiciones se rigen por la legislación colombiana, en particular por la Ley 1480 de 2011 (Estatuto del Consumidor). Cualquier controversia se someterá a los jueces competentes de la República de Colombia.",
        },
        {
          kind: "p",
          text: `Si quieres presentar una petición, queja o reclamo, escríbenos a ${m.email} y te responderemos en los plazos que fija la ley.`,
        },
      ],
    },
  ],
});
