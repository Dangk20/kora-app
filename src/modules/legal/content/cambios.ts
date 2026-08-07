// Política de cambios, retracto y garantía.
//
// ⚠️ ESTE ARCHIVO TIENE UN CONFLICTO ABIERTO CON EL CLIENTE.
//
// `business/kora-cashback-reglas-cliente.md` §6 dice literalmente: "KORA no
// realiza devoluciones de dinero. Únicamente se aceptan cambios de producto."
//
// Publicado tal cual en una tienda online colombiana ese texto sería una
// cláusula abusiva (Ley 1480/2011, arts. 42-43) e inaplicable, porque hay dos
// derechos que la ley NO deja renunciar por contrato:
//
//   1. Derecho de retracto (art. 47): en toda venta a distancia el comprador
//      puede retractarse dentro de los 5 días hábiles siguientes a la entrega,
//      y el vendedor DEBE devolver el dinero. KORA vende a distancia por
//      definición.
//   2. Garantía legal (arts. 7-8): ante un producto defectuoso el consumidor
//      elige, y la devolución del dinero es una de las opciones.
//
// Lo que sí es cierto y se publica: la política comercial del cliente —cambio
// dentro de 30 días calendario— es MÁS GENEROSA que el mínimo legal en plazo.
// Convive con esos dos derechos; no los sustituye.
//
// Este archivo publica las tres cosas en secciones SEPARADAS, sin condicionar
// los derechos legales a la política comercial. Hay una prueba
// (`tests/legal-content.test.ts`) que falla si alguien las omite o si el texto
// vuelve a contener una negación absoluta de devolución.
//
// PENDIENTE: visto bueno explícito del cliente sobre esta redacción antes del
// go-live. Ver ../../../../notas-tecnicas-privado.md.

import type { LegalDocumentFactory } from "./types";

/** Plazo comercial de cambio, definido por el cliente el 1 ago 2026. */
export const DIAS_CAMBIO = 30;

/** Plazo legal de retracto en ventas a distancia (Ley 1480/2011, art. 47). */
export const DIAS_HABILES_RETRACTO = 5;

export const cambios: LegalDocumentFactory = (m) => ({
  slug: "cambios",
  title: "Cambios, retracto y garantía",
  summary:
    "Nuestra política de cambios, y los derechos que la ley colombiana te reconoce siempre.",
  updatedAt: "2026-08-07",
  sections: [
    {
      heading: "En resumen",
      blocks: [
        {
          kind: "list",
          items: [
            `Cambio de producto por gusto o talla: hasta ${DIAS_CAMBIO} días calendario, con el producto sin usar.`,
            `Derecho de retracto: ${DIAS_HABILES_RETRACTO} días hábiles desde la entrega, con devolución del dinero.`,
            "Garantía legal: si el producto sale defectuoso, respondemos siempre.",
          ],
        },
        {
          kind: "p",
          text: "Los tres son distintos y funcionan por separado. Ninguno excluye a los otros.",
        },
      ],
    },
    {
      heading: `1. Cambio de producto (nuestra política, ${DIAS_CAMBIO} días)`,
      blocks: [
        {
          kind: "p",
          text: `Si el producto no era lo que esperabas —la talla, el color, el modelo— puedes cambiarlo dentro de los ${DIAS_CAMBIO} días calendario siguientes a la compra. Este plazo es nuestro, y es más amplio que el que exige la ley.`,
        },
        {
          kind: "p",
          text: "Para que podamos aceptar el cambio, el producto debe:",
        },
        {
          kind: "list",
          items: [
            "Estar completamente nuevo y sin usar.",
            "Conservar todas sus etiquetas originales.",
            "Mantener su empaque original en perfecto estado.",
          ],
        },
        {
          kind: "p",
          text: "Si el producto que eliges en el cambio cuesta más, pagas la diferencia. Si cuesta menos, la diferencia queda como saldo de Kora Cashback en tu cuenta.",
        },
        {
          kind: "note",
          text: `Sobre tu Kora Cashback en un cambio: si el producto nuevo vale lo mismo, conservas el cashback que ya habías ganado. Si vale más, se recalcula sobre el valor que finalmente pagaste.`,
        },
        {
          kind: "p",
          text: `Para solicitar un cambio, escríbenos por WhatsApp o a ${m.email} con tu número de pedido.`,
        },
      ],
    },
    {
      heading: `2. Derecho de retracto (la ley, ${DIAS_HABILES_RETRACTO} días hábiles)`,
      blocks: [
        {
          kind: "p",
          text: `Como compraste a distancia, el artículo 47 de la Ley 1480 de 2011 te da derecho a retractarte de la compra dentro de los ${DIAS_HABILES_RETRACTO} días hábiles siguientes a la entrega del producto, sin tener que explicar por qué.`,
        },
        {
          kind: "p",
          text: "Si ejerces el retracto, te devolvemos el dinero que pagaste. Este derecho es independiente de nuestra política de cambios y no está sujeto a sus condiciones.",
        },
        {
          kind: "list",
          items: [
            "El producto debe devolverse en las mismas condiciones en que lo recibiste.",
            "Los costos de transporte de la devolución corren por tu cuenta, como prevé la ley.",
            "Te devolvemos el dinero dentro de los treinta (30) días calendario siguientes a que ejerzas el retracto.",
            "Si en esa compra usaste saldo de Kora Cashback, ese saldo vuelve a tu cuenta.",
          ],
        },
        {
          kind: "p",
          text: `Para ejercerlo, escríbenos a ${m.email} o por WhatsApp indicando tu número de pedido y que deseas retractarte, dentro del plazo.`,
        },
        {
          kind: "note",
          text: "El retracto no aplica a productos hechos a la medida o personalizados a tu pedido, ni a bienes que por su naturaleza no puedan devolverse, según lo previsto en la misma norma.",
        },
      ],
    },
    {
      heading: "3. Garantía legal (producto defectuoso)",
      blocks: [
        {
          kind: "p",
          text: "Si el producto llega con un defecto, no es lo que se ofreció, o deja de funcionar como debería, tienes garantía legal conforme a los artículos 7 y 8 de la Ley 1480 de 2011. Esta garantía existe siempre, no hay que pagarla y no puede renunciarse.",
        },
        {
          kind: "p",
          text: "En ese caso responderemos con la reparación del producto, su reposición por uno igual, o la devolución del dinero que pagaste, según corresponda y conforme a la ley.",
        },
        {
          kind: "p",
          text: `Para hacerla efectiva escríbenos a ${m.email} o por WhatsApp con tu número de pedido y una descripción del problema. Respondemos dentro de los quince (15) días hábiles siguientes.`,
        },
        {
          kind: "note",
          text: "La garantía no cubre el daño causado por uso indebido, descuido o modificaciones hechas al producto después de la entrega.",
        },
      ],
    },
    {
      heading: "Cómo te devolvemos el dinero",
      blocks: [
        {
          kind: "p",
          text: "Como el pago no se procesa en la tienda sino que se coordina contigo por WhatsApp, la devolución se hace por el mismo medio que usaste para pagar, o por el que acordemos contigo.",
        },
      ],
    },
    {
      heading: "Si no quedas conforme",
      blocks: [
        {
          kind: "p",
          text: `Escríbenos primero a ${m.email}: casi todo se resuelve ahí. Si aun así no llegamos a un acuerdo, puedes acudir a la Superintendencia de Industria y Comercio, que es la autoridad de protección al consumidor en Colombia.`,
        },
      ],
    },
  ],
});
