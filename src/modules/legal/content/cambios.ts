// Política de cambios, reclamaciones, retracto y garantía.
//
// Texto base: las definiciones que el cliente envió el 12 sep 2026 (30 días
// de cambio voluntario, sus condiciones, envíos a cargo del comprador, 5 días
// hábiles para daños visibles con evidencia, garantía). Se adoptan casi tal
// cual.
//
// ⚠️ DOS COSAS QUE SU TEXTO NO TRAE Y QUE NO SE PUEDEN QUITAR:
//
//   1. Derecho de retracto (Ley 1480/2011, art. 47): en toda venta a distancia
//      el comprador puede retractarse dentro de los 5 días hábiles siguientes
//      a la entrega, y el vendedor DEBE devolver el dinero. Su "en los cambios
//      voluntarios no hay devolución de dinero" solo es válido FUERA de ese
//      plazo, y aquí se redacta así: como política propia que convive con el
//      retracto, no que lo sustituye.
//   2. Garantía legal (arts. 7-8 y 11): ante un defecto, si no procede la
//      reparación ni la reposición, procede la devolución del dinero. Su
//      "solución principal será la reposición" está bien como primera opción
//      y así se publica; la escala legal se mantiene.
//
// Hay una prueba (`tests/legal-content.test.ts`) que falla si alguien omite
// esas secciones o si el texto vuelve a contener una negación absoluta de
// devolución. Por eso "no se realizan devoluciones" se dice como "un cambio
// voluntario se resuelve con producto, no con dinero": mismo fondo, sin
// pisar el retracto.
//
// Aprobado por el cliente el 23 sep 2026.

import type { LegalDocumentFactory } from "./types";

/** Plazo comercial de cambio voluntario, definido por el cliente. */
export const DIAS_CAMBIO = 30;

/** Plazo legal de retracto en ventas a distancia (Ley 1480/2011, art. 47). */
export const DIAS_HABILES_RETRACTO = 5;

/** Plazo del cliente para reportar un producto recibido dañado o incompleto. */
export const DIAS_HABILES_REPORTE_DANO = 5;

export const cambios: LegalDocumentFactory = (m) => ({
  slug: "cambios",
  title: "Cambios, reclamaciones, retracto y garantía",
  summary:
    "Nuestra política de cambios, qué hacer si algo llega dañado, y los derechos que la ley colombiana te reconoce siempre.",
  updatedAt: "2026-09-12",
  sections: [
    {
      heading: "En resumen",
      blocks: [
        {
          kind: "list",
          items: [
            `Cambio voluntario por gusto o talla: hasta ${DIAS_CAMBIO} días calendario, con el producto nuevo y completo. Se resuelve con producto, y los envíos corren por tu cuenta.`,
            `Producto que llega dañado, roto o incompleto: repórtalo dentro de los ${DIAS_HABILES_REPORTE_DANO} días hábiles siguientes a la entrega, con fotos. Lo reponemos.`,
            `Derecho de retracto: ${DIAS_HABILES_RETRACTO} días hábiles desde la entrega, con devolución del dinero.`,
            "Garantía legal: si el producto sale defectuoso, respondemos siempre.",
          ],
        },
        {
          kind: "p",
          text: "Son cosas distintas y funcionan por separado. Ninguna excluye a las otras. Todas se rigen por la legislación colombiana, porque los productos se comercializan en Colombia, sin importar si pagaste en pesos o en dólares: la moneda de pago no cambia ninguna de estas condiciones.",
        },
      ],
    },
    {
      heading: `1. Cambio voluntario (nuestra política, ${DIAS_CAMBIO} días)`,
      blocks: [
        {
          kind: "p",
          text: `KORA comercializa productos de distintas categorías, así que algunas condiciones pueden variar según la naturaleza del producto. Como regla general, si el producto no era lo que esperabas —la talla, el color, el modelo— puedes cambiarlo dentro de los ${DIAS_CAMBIO} días calendario siguientes a la compra, siempre que:`,
        },
        {
          kind: "list",
          items: [
            "Esté completamente nuevo y sin señales de uso.",
            "Conserve sus etiquetas originales, cuando aplique.",
            "Conserve su empaque original en perfecto estado, cuando aplique.",
            "Incluya accesorios, piezas, manuales y demás componentes originales, cuando corresponda.",
            "Esté en condiciones aptas para volver a venderse.",
            "Se pueda asociar a tu compra (tu número de pedido o comprobante).",
          ],
        },
        {
          kind: "note",
          text: "Algunas categorías tienen restricciones de cambio por razones de higiene, de seguridad o por la propia naturaleza del producto. Te lo indicamos en la ficha del producto cuando aplica.",
        },
        {
          kind: "p",
          text: "Un cambio voluntario se resuelve con producto, no con dinero. Si el producto que eliges cuesta más, pagas la diferencia. Si cuesta menos, la diferencia no se reembolsa: puedes completarla con otro u otros productos.",
        },
        {
          kind: "p",
          text: "El valor del envío es independiente del valor del producto y nunca cuenta como parte del valor disponible para el cambio. Por ejemplo, si un producto cuesta $100.000 y su envío costó $15.000, para efectos del cambio el producto vale $100.000, no $115.000.",
        },
        {
          kind: "p",
          text: "En un cambio voluntario asumes los dos trayectos: el retorno del producto a KORA y el envío del producto que elijas.",
        },
        {
          kind: "p",
          text: `Para solicitarlo, escríbenos por WhatsApp o a ${m.email} con tu número de pedido.`,
        },
      ],
    },
    {
      heading: `2. Producto recibido dañado, roto o incompleto (${DIAS_HABILES_REPORTE_DANO} días hábiles)`,
      blocks: [
        {
          kind: "p",
          text: `Si al recibir el pedido encuentras un producto roto, golpeado, incompleto, con piezas faltantes o con un defecto visible, repórtalo de inmediato y como máximo dentro de los ${DIAS_HABILES_REPORTE_DANO} días hábiles siguientes a la entrega, para iniciar la reclamación.`,
        },
        {
          kind: "p",
          text: "Necesitaremos fotografías o videos claros de:",
        },
        {
          kind: "list",
          items: [
            "El empaque exterior.",
            "La guía o etiqueta de envío.",
            "El estado en que recibiste el paquete.",
            "El producto afectado y el daño o defecto concreto.",
            "Las piezas, accesorios y contenido recibido, cuando aplique.",
          ],
        },
        {
          kind: "p",
          text: "Por nuestra parte, cuando corresponde, conservamos evidencia fotográfica o en video del estado de los productos y de la preparación de los pedidos antes de enviarlos. Si verificamos que el producto salió en perfectas condiciones y el daño ocurrió en el transporte, usamos ambas evidencias para presentar el reclamo ante la compañía logística.",
        },
        {
          kind: "p",
          text: "Una vez validado el caso, nuestra solución principal es la reposición del mismo producto, sujeta a disponibilidad, u otro producto o productos por un valor equivalente al artículo afectado. Si ninguna de las dos es posible, aplica la garantía legal de la sección 4, que incluye la devolución del dinero.",
        },
        {
          kind: "note",
          text: "Esto no es un cambio voluntario: los costos logísticos se manejan según corresponda al reclamo y a las obligaciones legales, no por tu cuenta.",
        },
        {
          kind: "p",
          text: `Este plazo de ${DIAS_HABILES_REPORTE_DANO} días hábiles es para daños, faltantes o defectos visibles al momento de recibir. No reemplaza la garantía legal del producto.`,
        },
      ],
    },
    {
      heading: `3. Derecho de retracto (la ley, ${DIAS_HABILES_RETRACTO} días hábiles)`,
      blocks: [
        {
          kind: "p",
          text: `Como compraste a distancia, el artículo 47 de la Ley 1480 de 2011 te da derecho a retractarte de la compra dentro de los ${DIAS_HABILES_RETRACTO} días hábiles siguientes a la entrega del producto, sin tener que explicar por qué.`,
        },
        {
          kind: "p",
          text: "Si ejerces el retracto, te devolvemos el dinero que pagaste. Este derecho es independiente de nuestra política de cambios voluntarios y no está sujeto a sus condiciones.",
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
      heading: "4. Garantía legal (producto defectuoso)",
      blocks: [
        {
          kind: "p",
          text: "Si después de recibirlo un producto presenta una falla o defecto que no sea consecuencia de uso indebido, desgaste normal, manipulación incorrecta, accidente u otra causal aplicable, tienes garantía legal conforme a los artículos 7 y 8 de la Ley 1480 de 2011. Esta garantía existe siempre, no hay que pagarla y no puede renunciarse.",
        },
        {
          kind: "p",
          text: "Evaluamos cada caso teniendo en cuenta la categoría y naturaleza del producto, el tipo de falla, la garantía que le corresponde, las condiciones del fabricante cuando aplican y la legislación colombiana de protección al consumidor.",
        },
        {
          kind: "p",
          text: "Según el caso procede la reparación del producto, su reposición por uno igual, el cambio, o la devolución del dinero que pagaste, en ese orden y conforme a la ley.",
        },
        {
          kind: "p",
          text: `Para hacerla efectiva escríbenos a ${m.email} o por WhatsApp con tu número de pedido y una descripción del problema. Respondemos dentro de los quince (15) días hábiles siguientes.`,
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
