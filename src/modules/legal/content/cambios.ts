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
// Aprobado por el cliente el 23 sep 2026. El 10 oct (change `centro-legal`) se
// añadió el reembolso de los pagos con tarjeta y la versión en inglés; el
// fondo de la política no cambió.

import { PREVALECE_ESPANOL } from "./common";
import type { BilingualDocument, LegalDocumentFactory } from "./types";

/** Plazo comercial de cambio voluntario, definido por el cliente. */
export const DIAS_CAMBIO = 30;

/** Plazo legal de retracto en ventas a distancia (Ley 1480/2011, art. 47). */
export const DIAS_HABILES_RETRACTO = 5;

/** Plazo del cliente para reportar un producto recibido dañado o incompleto. */
export const DIAS_HABILES_REPORTE_DANO = 5;

const ACTUALIZADO = "2026-10-10";

const es: LegalDocumentFactory = (m) => ({
  slug: "cambios",
  title: "Cambios, devoluciones y reembolsos",
  shortTitle: "Cambios y reembolsos",
  summary:
    "Nuestra política de cambios, qué hacer si algo llega dañado, cómo te devolvemos el dinero y los derechos que la ley colombiana te reconoce siempre.",
  updatedAt: ACTUALIZADO,
  sections: [
    {
      id: "resumen",
      heading: "En resumen",
      summary: "Cambio voluntario, producto dañado, retracto y garantía son cuatro cosas distintas, y ninguna excluye a las otras.",
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
      id: "cambio-voluntario",
      summary: `Hasta ${DIAS_CAMBIO} días para cambiar un producto nuevo y completo. Se resuelve con producto y los envíos corren por tu cuenta.`,
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
      id: "producto-danado",
      summary: `Repórtalo dentro de los ${DIAS_HABILES_REPORTE_DANO} días hábiles siguientes a la entrega, con fotos, y lo reponemos.`,
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
      id: "retracto",
      summary: `${DIAS_HABILES_RETRACTO} días hábiles desde la entrega para retractarte, con devolución del dinero.`,
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
      id: "garantia",
      heading: "4. Garantía legal (producto defectuoso)",
      summary: "Si el producto sale defectuoso, respondemos siempre: reparación, reposición, cambio o devolución del dinero.",
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
      id: "reembolsos",
      heading: "Cómo te devolvemos el dinero",
      summary: "Por el mismo medio con que pagaste: si fue con tarjeta, a la misma tarjeta.",
      blocks: [
        {
          kind: "list",
          items: [
            "Si pagaste con tarjeta, el reembolso se hace a la misma tarjeta y en la misma moneda del pago. Lo ordenamos dentro de los plazos de esta política; el tiempo en que se refleja en tu extracto depende de tu banco emisor.",
            "Si pagaste con otro medio, la devolución se hace por ese mismo medio, o por el que acordemos contigo.",
            "Devolvemos el valor pagado por el producto. Si en esa compra usaste saldo de Kora Cashback, ese saldo vuelve a tu cuenta.",
          ],
        },
      ],
    },
    {
      id: "reclamos",
      heading: "Si no quedas conforme",
      summary: "Escríbenos primero; si no llegamos a un acuerdo, puedes acudir a la Superintendencia de Industria y Comercio.",
      blocks: [
        {
          kind: "p",
          text: `Escríbenos primero a ${m.email}: casi todo se resuelve ahí. Si aun así no llegamos a un acuerdo, puedes acudir a la Superintendencia de Industria y Comercio, que es la autoridad de protección al consumidor en Colombia.`,
        },
      ],
    },
  ],
});

const en: LegalDocumentFactory = (m) => ({
  slug: "cambios",
  title: "Exchanges, Returns and Refunds",
  shortTitle: "Exchanges and refunds",
  summary:
    "Our exchange policy, what to do if something arrives damaged, how we refund you, and the rights Colombian law always grants you.",
  updatedAt: ACTUALIZADO,
  sections: [
    {
      id: "resumen",
      heading: "In short",
      summary: "Voluntary exchange, damaged product, withdrawal and warranty are four different things, and none excludes the others.",
      blocks: [
        {
          kind: "list",
          items: [
            `Voluntary exchange for taste or size: up to ${DIAS_CAMBIO} calendar days, with the product new and complete. It is resolved with product, and shipping is at your expense.`,
            `Product that arrives damaged, broken or incomplete: report it within ${DIAS_HABILES_REPORTE_DANO} business days after delivery, with photos. We replace it.`,
            `Right of withdrawal: ${DIAS_HABILES_RETRACTO} business days from delivery, with a refund.`,
            "Legal warranty: if the product turns out to be defective, we always stand behind it.",
          ],
        },
        {
          kind: "p",
          text: "They are different things and work separately. None excludes the others. All of them are governed by Colombian law, because products are sold in Colombia, regardless of whether you paid in pesos or dollars: the payment currency does not change any of these conditions.",
        },
        { kind: "note", text: PREVALECE_ESPANOL },
      ],
    },
    {
      id: "cambio-voluntario",
      summary: `Up to ${DIAS_CAMBIO} days to exchange a new, complete product. It is resolved with product and shipping is at your expense.`,
      heading: `1. Voluntary exchange (our policy, ${DIAS_CAMBIO} days)`,
      blocks: [
        {
          kind: "p",
          text: `KORA sells products from different categories, so some conditions may vary with the nature of the product. As a general rule, if the product was not what you expected —size, color, model— you can exchange it within ${DIAS_CAMBIO} calendar days after the purchase, as long as it:`,
        },
        {
          kind: "list",
          items: [
            "Is completely new and shows no signs of use.",
            "Keeps its original tags, when applicable.",
            "Keeps its original packaging in perfect condition, when applicable.",
            "Includes its original accessories, parts, manuals and other components, when applicable.",
            "Is in a condition fit for resale.",
            "Can be linked to your purchase (your order number or receipt).",
          ],
        },
        {
          kind: "note",
          text: "Some categories have exchange restrictions for hygiene, safety or the nature of the product. We say so on the product page when it applies.",
        },
        {
          kind: "p",
          text: "A voluntary exchange is resolved with product, not money. If the product you choose costs more, you pay the difference. If it costs less, the difference is not refunded: you can complete it with one or more other products.",
        },
        {
          kind: "p",
          text: "The shipping cost is separate from the product price and never counts toward the value available for the exchange. For example, if a product costs $100,000 and its shipping cost $15,000, for the exchange the product is worth $100,000, not $115,000.",
        },
        { kind: "p", text: "In a voluntary exchange you cover both legs: returning the product to KORA and shipping the product you choose." },
        { kind: "p", text: `To request it, write to us through WhatsApp or at ${m.email} with your order number.` },
      ],
    },
    {
      id: "producto-danado",
      summary: `Report it within ${DIAS_HABILES_REPORTE_DANO} business days after delivery, with photos, and we replace it.`,
      heading: `2. Product received damaged, broken or incomplete (${DIAS_HABILES_REPORTE_DANO} business days)`,
      blocks: [
        {
          kind: "p",
          text: `If, when you receive the order, a product is broken, dented, incomplete, missing parts or has a visible defect, report it immediately and no later than ${DIAS_HABILES_REPORTE_DANO} business days after delivery, to start the claim.`,
        },
        { kind: "p", text: "We will need clear photos or videos of:" },
        {
          kind: "list",
          items: [
            "The outer packaging.",
            "The shipping label.",
            "The condition in which you received the package.",
            "The affected product and the specific damage or defect.",
            "The parts, accessories and contents received, when applicable.",
          ],
        },
        {
          kind: "p",
          text: "On our side, when applicable, we keep photo or video evidence of the condition of the products and of how orders are packed before shipping. If we verify that the product left in perfect condition and the damage happened in transit, we use both sets of evidence to file the claim with the carrier.",
        },
        {
          kind: "p",
          text: "Once the case is validated, our main solution is replacing the same product, subject to availability, or another product or products of equivalent value. If neither is possible, the legal warranty in section 4 applies, which includes a refund.",
        },
        { kind: "note", text: "This is not a voluntary exchange: logistics costs are handled according to the claim and legal obligations, not at your expense." },
        {
          kind: "p",
          text: `This ${DIAS_HABILES_REPORTE_DANO}-business-day period is for damage, missing items or defects visible upon receipt. It does not replace the product's legal warranty.`,
        },
      ],
    },
    {
      id: "retracto",
      summary: `${DIAS_HABILES_RETRACTO} business days from delivery to withdraw from the purchase, with a refund.`,
      heading: `3. Right of withdrawal (the law, ${DIAS_HABILES_RETRACTO} business days)`,
      blocks: [
        {
          kind: "p",
          text: `Because you bought at a distance, article 47 of Colombian Law 1480 of 2011 gives you the right to withdraw from the purchase within ${DIAS_HABILES_RETRACTO} business days after the product is delivered, without having to explain why.`,
        },
        {
          kind: "p",
          text: "If you exercise this right, we refund the money you paid. This right is independent of our voluntary exchange policy and is not subject to its conditions.",
        },
        {
          kind: "list",
          items: [
            "The product must be returned in the same condition in which you received it.",
            "The return shipping costs are at your expense, as the law provides.",
            "We refund the money within thirty (30) calendar days after you exercise the right.",
            "If you used Kora Cashback balance in that purchase, the balance goes back to your account.",
          ],
        },
        {
          kind: "p",
          text: `To exercise it, write to ${m.email} or through WhatsApp with your order number, stating that you wish to withdraw, within the period.`,
        },
        {
          kind: "note",
          text: "The right of withdrawal does not apply to products made to measure or personalized for your order, or to goods that by their nature cannot be returned, as provided by the same law.",
        },
      ],
    },
    {
      id: "garantia",
      heading: "4. Legal warranty (defective product)",
      summary: "If the product turns out to be defective, we always stand behind it: repair, replacement, exchange or refund.",
      blocks: [
        {
          kind: "p",
          text: "If, after you receive it, a product has a fault or defect that is not the result of misuse, normal wear, improper handling, accident or another applicable cause, you have a legal warranty under articles 7 and 8 of Colombian Law 1480 of 2011. This warranty always exists, is free and cannot be waived.",
        },
        {
          kind: "p",
          text: "We assess each case considering the product's category and nature, the type of fault, the warranty that applies to it, the manufacturer's conditions when applicable, and Colombian consumer protection law.",
        },
        {
          kind: "p",
          text: "Depending on the case, the remedy is repairing the product, replacing it with an identical one, exchanging it, or refunding the money you paid, in that order and as the law provides.",
        },
        {
          kind: "p",
          text: `To claim it, write to ${m.email} or through WhatsApp with your order number and a description of the problem. We answer within fifteen (15) business days.`,
        },
      ],
    },
    {
      id: "reembolsos",
      heading: "How we refund you",
      summary: "Through the same method you paid with: if it was a card, to the same card.",
      blocks: [
        {
          kind: "list",
          items: [
            "If you paid by card, the refund goes to the same card and in the same currency as the payment. We issue it within the time limits of this policy; how long it takes to appear on your statement depends on your issuing bank.",
            "If you paid by another method, the refund is made through that same method, or through one we agree with you.",
            "We refund the amount paid for the product. If you used Kora Cashback balance in that purchase, the balance goes back to your account.",
          ],
        },
      ],
    },
    {
      id: "reclamos",
      heading: "If you are not satisfied",
      summary: "Write to us first; if we cannot reach an agreement, you can go to the Superintendence of Industry and Commerce.",
      blocks: [
        {
          kind: "p",
          text: `Write to us first at ${m.email}: almost everything is solved there. If we still cannot reach an agreement, you can go to the Superintendence of Industry and Commerce (SIC), the consumer protection authority in Colombia.`,
        },
      ],
    },
  ],
});

export const cambios: BilingualDocument = { es, en };
