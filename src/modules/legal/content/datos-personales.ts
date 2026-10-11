// Política de tratamiento de datos personales (Ley 1581 de 2012, Decreto 1377
// de 2013).
//
// Es la política a la que apunta la casilla obligatoria del checkout: tiene
// que identificar al responsable, decir para qué se usan los datos y cómo se
// ejercen los derechos, o el consentimiento no acredita nada ante la SIC.
//
// Desde el change `centro-legal` (10 oct 2026) cubre además el pago con
// tarjeta: los datos de la tarjeta los captura el procesador en su página
// alojada y KORA no los recibe. Y declara la transferencia de los datos del
// pedido a la matriz en EE.UU., que procesa los cobros con tarjeta: una
// transferencia internacional que no se nombra no está autorizada.

import { PREVALECE_ESPANOL, presentacionEn, presentacionEs } from "./common";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-11";

export const datosPersonales: BilingualDocument = {
  es: (m, c) => ({
    slug: "datos-personales",
    title: "Política de privacidad y tratamiento de datos personales",
    shortTitle: "Privacidad y tratamiento de datos",
    summary: "Quién trata tus datos, para qué, con quién se comparten y qué puedes exigir en cualquier momento.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "responsable",
        heading: "Responsable del tratamiento",
        summary: `${m.razonSocial} es la responsable de tus datos personales.`,
        blocks: [
          {
            kind: "p",
            text: `${m.razonSocial}, sociedad identificada con NIT ${m.nit} y con domicilio en ${m.domicilio}, actúa como responsable del tratamiento de los datos personales recogidos a través de esta tienda y de sus canales de atención.`,
          },
          { kind: "p", text: presentacionEs(m) },
          { kind: "p", text: `Para cualquier asunto relacionado con tus datos personales puedes escribir a ${m.email}.` },
        ],
      },
      {
        id: "marco-legal",
        heading: "Marco legal, definiciones y principios",
        summary: "Tratamos tus datos conforme a la Ley 1581 de 2012 y sus normas reglamentarias, con ocho principios.",
        blocks: [
          {
            kind: "p",
            text: "Esta política se rige por los artículos 15 y 20 de la Constitución Política de Colombia, la Ley 1581 de 2012, el Decreto 1074 de 2015 (que compila los Decretos 1377 de 2013 y 886 de 2014), la Circular Externa 005 de 2017 de la Superintendencia de Industria y Comercio y las demás normas que las modifiquen o complementen.",
          },
          {
            kind: "list",
            items: [
              "Titular: la persona a quien se refieren los datos; en esta tienda, tú.",
              "Tratamiento: cualquier operación sobre los datos, como recogerlos, guardarlos, usarlos, compartirlos o suprimirlos.",
              "Autorización: tu consentimiento previo, expreso e informado para el tratamiento.",
              "Responsable: quien decide sobre el tratamiento; en este caso, KORA.",
              "Encargado: quien trata los datos por cuenta del responsable, como la transportadora o el proveedor de alojamiento.",
              "Dato sensible: el que afecta tu intimidad o puede generar discriminación, como el origen racial, la orientación política, las convicciones religiosas, la salud, la vida sexual o los datos biométricos.",
              "Transferencia y transmisión: el envío de datos a un tercero que los trata como responsable (transferencia) o por cuenta nuestra (transmisión).",
            ],
          },
          {
            kind: "p",
            text: "Aplicamos los principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad.",
          },
        ],
      },
      {
        id: "datos",
        heading: "Qué datos recogemos",
        summary: "Solo los que necesitamos para venderte, entregarte y atenderte. Nunca los datos de tu tarjeta.",
        blocks: [
          { kind: "p", text: "Únicamente los que necesitamos para venderte y atenderte:" },
          {
            kind: "list",
            items: [
              "Nombre y apellidos, y documento de identidad cuando lo indicas.",
              "Correo electrónico.",
              "Número de teléfono, para coordinar el pedido y la entrega.",
              "Dirección de facturación y dirección de entrega.",
              "Historial de tus pedidos y de tu saldo de Kora Cashback.",
              "El resultado de tus pagos con tarjeta (aprobado o rechazado), su referencia y su valor.",
            ],
          },
          {
            kind: "p",
            text: "No recibimos, no vemos y no almacenamos los datos de tu tarjeta de crédito o débito (número, fecha de vencimiento ni código de seguridad). Los escribes directamente en la página de pago segura de nuestro procesador de pagos, que es quien los trata.",
          },
          {
            kind: "note",
            text: "No recogemos datos sensibles ni datos de menores de edad. Si crees que nos has entregado alguno por error, escríbenos y lo eliminamos.",
          },
        ],
      },
      {
        id: "finalidades",
        heading: "Para qué los usamos",
        summary: "Para gestionar tus pedidos, pagos, entregas y solicitudes. El marketing requiere una autorización aparte.",
        blocks: [
          {
            kind: "list",
            items: [
              "Registrar tu pedido y mantener el detalle de lo que compraste.",
              "Procesar tu pago con tarjeta o coordinar contigo, por WhatsApp, el pago con otro medio.",
              "Enviarte por correo electrónico el comprobante de cada cambio de estado de tu pedido: recibido, confirmado, en preparación, despachado, entregado, cancelado o vencido.",
              "Calcular y acreditar tu saldo de Kora Cashback, y avisarte de su vencimiento.",
              "Gestionar tus envíos: el nombre, teléfono y dirección del destinatario van a la transportadora para que pueda entregar.",
              "Atender tus solicitudes de cambio, garantía, retracto, reembolso y reclamación, y brindarte servicio al cliente.",
              "Presentar reclamos ante la compañía logística cuando un producto llega dañado o incompleto, con la evidencia que nos envíes.",
              "Proteger las transacciones y prevenir el fraude.",
              "Cumplir obligaciones legales, contables y tributarias.",
            ],
          },
          {
            kind: "p",
            text: "Enviarte novedades, lanzamientos y promociones es una finalidad distinta y requiere tu autorización aparte: la casilla opcional del checkout, o la suscripción desde la tienda. Puedes retirarla cuando quieras sin afectar tus compras.",
          },
          {
            kind: "note",
            text: "Darte de baja de las comunicaciones comerciales no cancela los comprobantes de tus pedidos. Esos correos no son publicidad: son la constancia de lo que compraste y de lo que pagaste.",
          },
        ],
      },
      {
        id: "autorizacion",
        heading: "Cómo obtenemos tu autorización",
        summary: "Te la pedimos antes de tratar tus datos, te decimos para qué y guardamos constancia.",
        blocks: [
          {
            kind: "p",
            text: "Te pedimos autorización antes de tratar tus datos, por medios que permiten guardar constancia: la casilla obligatoria del checkout, el registro de tu cuenta, el aviso de cookies o la conversación por WhatsApp. Al pedirla te informamos el tratamiento, su finalidad, tus derechos y cómo contactarnos.",
          },
          {
            kind: "p",
            text: "Responder preguntas sobre datos sensibles o sobre menores de edad es siempre opcional. Si un menor de edad compra a través de la tienda, la autorización debe darla su representante legal.",
          },
        ],
      },
      {
        id: "compartir",
        heading: "Con quién los compartimos",
        summary: "Solo con quien necesitamos para cobrar, entregar y operar la tienda. Nunca los vendemos.",
        blocks: [
          { kind: "p", text: "No vendemos, arrendamos ni cedemos tus datos personales a terceros con fines comerciales. Solo los conocen, con instrucciones nuestras y sin autorización para usarlos para nada más:" },
          {
            kind: "list",
            items: [
              `${m.llc.razonSocial}, nuestra sociedad matriz en Estados Unidos, y su procesador de pagos, cuando pagas con tarjeta: reciben los datos del pedido necesarios para procesar el cobro (nombre, correo, dirección de facturación y valor).`,
              "La compañía transportadora, para entregar tu pedido.",
              "Los proveedores que nos prestan servicios necesarios para operar la tienda: alojamiento de la plataforma, envío de correo electrónico y almacenamiento de imágenes.",
            ],
          },
          {
            kind: "p",
            text: "Algunos de estos destinatarios están en Estados Unidos. Al aceptar esta política autorizas esa transferencia internacional de datos, que se hace con las mismas finalidades y garantías descritas aquí, conforme al artículo 26 de la Ley 1581 de 2012.",
          },
        ],
      },
      {
        id: "derechos",
        heading: "Tus derechos como titular",
        summary: "Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar tu autorización, gratis y en cualquier momento.",
        blocks: [
          { kind: "p", text: "La Ley 1581 de 2012 te reconoce, en cualquier momento y de forma gratuita:" },
          {
            kind: "list",
            items: [
              "Conocer qué datos tuyos tenemos y cómo los estamos usando.",
              "Actualizarlos o rectificarlos cuando estén incompletos o equivocados.",
              "Solicitar su supresión, salvo cuando exista un deber legal o contractual de conservarlos.",
              "Revocar la autorización que nos diste.",
              "Ser informado del uso que se ha dado a tus datos, cuando lo solicites.",
              "Presentar quejas ante la Superintendencia de Industria y Comercio.",
            ],
          },
          {
            kind: "p",
            text: `Para ejercer cualquiera de ellos escribe a ${m.email} indicando tu nombre y el derecho que quieres ejercer. El trámite y los plazos están en la sección «Cómo presentar consultas y reclamos».`,
          },
          {
            kind: "note",
            text: "Ten en cuenta que si pides eliminar tus datos, perderás el acceso a tu historial de pedidos y el saldo de Kora Cashback asociado a tu cuenta. Conservaremos únicamente la información de las ventas que la ley nos obliga a guardar por razones contables y tributarias.",
          },
        ],
      },
      {
        id: "procedimiento",
        heading: "Cómo presentar consultas y reclamos",
        summary: "Por correo o WhatsApp. Consultas: 10 días hábiles. Reclamos: 15 días hábiles. Sin costo.",
        blocks: [
          {
            kind: "p",
            text: `Puedes presentarlos tú, tus causahabientes, tu representante o tu apoderado, sin ningún costo, escribiendo a ${m.email} o por WhatsApp. La solicitud debe indicar el nombre del titular, lo que pides, una dirección o correo para responderte y, si aplica, los documentos que quieras hacer valer.`,
          },
          {
            kind: "list",
            items: [
              "Consultas (conocer qué datos tenemos y cómo los usamos): respondemos en un máximo de diez (10) días hábiles desde que recibimos la solicitud. Si no es posible, te explicamos el motivo y respondemos en un plazo que no excede cinco (5) días hábiles adicionales.",
              "Reclamos (corregir, actualizar o suprimir datos, revocar la autorización o advertir un incumplimiento): respondemos en un máximo de quince (15) días hábiles desde que recibimos la solicitud. Si no es posible, te explicamos el motivo y respondemos en un plazo que no excede ocho (8) días hábiles adicionales.",
              "Si el reclamo está incompleto, te pedimos completarlo dentro de los cinco (5) días siguientes. Si pasan dos (2) meses sin que lo completes, se entiende que desististe.",
              "Mientras resolvemos un reclamo completo, marcamos tus datos con la leyenda «reclamo en trámite» en un máximo de dos (2) días hábiles.",
            ],
          },
          {
            kind: "p",
            text: "Agotado este trámite, puedes acudir a la Superintendencia de Industria y Comercio.",
          },
        ],
      },
      {
        id: "conservacion",
        heading: "Cuánto tiempo los conservamos",
        summary: "Mientras los necesitemos para atenderte y durante los plazos que exige la ley.",
        blocks: [
          {
            kind: "p",
            text: "Conservamos tus datos mientras tengas una cuenta activa o mientras sigan siendo necesarios para las finalidades descritas. Después, únicamente durante los plazos que exigen las normas contables, tributarias y comerciales aplicables.",
          },
        ],
      },
      {
        id: "seguridad",
        heading: "Seguridad",
        summary: "Conexión cifrada, accesos restringidos y ningún dato de tarjeta en nuestros sistemas.",
        blocks: [
          {
            kind: "p",
            text: "Aplicamos medidas técnicas y administrativas razonables para proteger tus datos: toda la conexión con la tienda viaja cifrada, el acceso al panel de administración está restringido por permisos, y las contraseñas se almacenan cifradas y nunca en texto plano. Los detalles sobre los pagos con tarjeta están en nuestra política de seguridad de pagos.",
          },
          {
            kind: "p",
            text: "Ningún sistema es infalible. Si llegara a ocurrir un incidente que afecte tus datos personales, lo registramos, aplicamos las medidas para contenerlo, lo reportamos a la Superintendencia de Industria y Comercio dentro de los quince (15) días hábiles siguientes a su detección y te informamos cuando pueda afectarte de manera significativa.",
          },
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        summary: c?.medicion
          ? "Usamos cookies necesarias y, solo si las aceptas, cookies de análisis y publicidad."
          : "Solo usamos cookies necesarias para que la tienda funcione.",
        blocks: c?.medicion
          ? [
              {
                kind: "p",
                text: "Usamos cookies necesarias para que la tienda funcione y, solo si las aceptas en el aviso de cookies, cookies de análisis y publicidad de aliados que nos ayudan a mejorar la tienda y medir nuestra publicidad. Cuando confirmamos el pedido de quien las aceptó, informamos a esos aliados que la compra ocurrió, con los datos de contacto cifrados de forma irreversible. Algunos de ellos están en Estados Unidos.",
              },
              {
                kind: "p",
                text: "El detalle de qué cookies usamos, para qué y cómo aceptarlas, rechazarlas o borrarlas está en nuestra Política de cookies.",
              },
            ]
          : [
              {
                kind: "p",
                text: "Esta tienda usa únicamente cookies estrictamente necesarias para funcionar: mantener tu sesión iniciada, recordar la moneda y el idioma que elegiste y conservar los productos de tu carrito. No usamos cookies de publicidad ni de seguimiento de terceros, y no perfilamos tu comportamiento de navegación.",
              },
            ],
      },
      {
        id: "cambios-politica",
        heading: "Cambios en esta política",
        summary: "Publicamos cada versión con su fecha y te avisamos de los cambios importantes.",
        blocks: [
          {
            kind: "p",
            text: "Si modificamos esta política publicaremos la nueva versión en esta misma página, con su fecha de actualización. Cuando el cambio afecte de forma sustancial las finalidades del tratamiento, te lo comunicaremos antes de aplicarlo.",
          },
          {
            kind: "p",
            text: "Esta política rige desde la fecha de actualización indicada al inicio. Los datos se tratan durante el tiempo necesario para las finalidades descritas; revocada la autorización, se suprimen salvo que una obligación legal o contractual exija conservarlos, caso en el que te lo informamos.",
          },
        ],
      },
    ],
  }),

  en: (m, c) => ({
    slug: "datos-personales",
    title: "Privacy and Personal Data Policy",
    shortTitle: "Privacy policy",
    summary: "Who processes your data, for what, with whom it is shared, and what you can request at any time.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "responsable",
        heading: "Data controller",
        summary: `${m.razonSocial} is the controller of your personal data.`,
        blocks: [
          {
            kind: "p",
            text: `${m.razonSocial}, a company identified with Colombian tax ID (NIT) ${m.nit} and with its address at ${m.domicilio}, is the controller of the personal data collected through this store and its customer service channels.`,
          },
          { kind: "p", text: presentacionEn(m) },
          { kind: "p", text: `For any matter related to your personal data, write to ${m.email}.` },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "marco-legal",
        heading: "Legal framework, definitions and principles",
        summary: "We process your data under Colombian Law 1581 of 2012 and its regulations, following eight principles.",
        blocks: [
          {
            kind: "p",
            text: "This policy is governed by articles 15 and 20 of the Political Constitution of Colombia, Law 1581 of 2012, Decree 1074 of 2015 (which compiles Decrees 1377 of 2013 and 886 of 2014), External Circular 005 of 2017 of the Superintendence of Industry and Commerce, and any rules that amend or complement them.",
          },
          {
            kind: "list",
            items: [
              "Data subject: the person the data refers to; in this store, you.",
              "Processing: any operation on the data, such as collecting, storing, using, sharing or deleting it.",
              "Authorization: your prior, express and informed consent to the processing.",
              "Controller: whoever decides on the processing; in this case, KORA.",
              "Processor: whoever processes data on the controller's behalf, such as the carrier or the hosting provider.",
              "Sensitive data: data that affects your privacy or may lead to discrimination, such as racial origin, political orientation, religious beliefs, health, sex life or biometric data.",
              "Transfer and transmission: sending data to a third party that processes it as a controller (transfer) or on our behalf (transmission).",
            ],
          },
          {
            kind: "p",
            text: "We apply the principles of legality, purpose, freedom, accuracy or quality, transparency, restricted access and circulation, security and confidentiality.",
          },
        ],
      },
      {
        id: "datos",
        heading: "What data we collect",
        summary: "Only what we need to sell to you, deliver and assist you. Never your card details.",
        blocks: [
          { kind: "p", text: "Only what we need to sell to you and assist you:" },
          {
            kind: "list",
            items: [
              "First and last name, and ID document when you provide it.",
              "Email address.",
              "Phone number, to coordinate the order and delivery.",
              "Billing address and delivery address.",
              "Your order history and Kora Cashback balance.",
              "The result of your card payments (approved or declined), their reference and amount.",
            ],
          },
          {
            kind: "p",
            text: "We do not receive, see or store your credit or debit card details (number, expiration date or security code). You enter them directly on our payment processor's secure payment page, and the processor handles them.",
          },
          { kind: "note", text: "We do not collect sensitive data or data from minors. If you believe you gave us any by mistake, write to us and we will delete it." },
        ],
      },
      {
        id: "finalidades",
        heading: "How we use it",
        summary: "To manage your orders, payments, deliveries and requests. Marketing requires a separate consent.",
        blocks: [
          {
            kind: "list",
            items: [
              "Record your order and keep the details of what you bought.",
              "Process your card payment, or arrange payment by another method with you through WhatsApp.",
              "Email you a receipt for each status change of your order: received, confirmed, being prepared, shipped, delivered, cancelled or expired.",
              "Calculate and credit your Kora Cashback balance, and notify you before it expires.",
              "Manage your shipments: the recipient's name, phone and address go to the carrier so it can deliver.",
              "Handle your exchange, warranty, withdrawal, refund and claim requests, and provide customer service.",
              "File claims with the carrier when a product arrives damaged or incomplete, using the evidence you send us.",
              "Protect transactions and prevent fraud.",
              "Comply with legal, accounting and tax obligations.",
            ],
          },
          {
            kind: "p",
            text: "Sending you news, launches and promotions is a different purpose and requires a separate consent: the optional checkbox at checkout, or subscribing from the store. You can withdraw it at any time without affecting your purchases.",
          },
          { kind: "note", text: "Unsubscribing from marketing does not stop your order receipts. Those emails are not advertising: they are the record of what you bought and paid." },
        ],
      },
      {
        id: "autorizacion",
        heading: "How we obtain your authorization",
        summary: "We ask before processing your data, tell you why, and keep a record.",
        blocks: [
          {
            kind: "p",
            text: "We ask for your authorization before processing your data, through means that let us keep a record: the mandatory checkbox at checkout, your account registration, the cookie notice or the WhatsApp conversation. When asking, we tell you about the processing, its purpose, your rights and how to contact us.",
          },
          {
            kind: "p",
            text: "Answering questions about sensitive data or minors is always optional. If a minor buys through the store, authorization must be given by their legal representative.",
          },
        ],
      },
      {
        id: "compartir",
        heading: "Who we share it with",
        summary: "Only with those we need to charge, deliver and run the store. We never sell it.",
        blocks: [
          { kind: "p", text: "We do not sell, rent or transfer your personal data to third parties for commercial purposes. It is only known, under our instructions and with no authorization to use it for anything else, by:" },
          {
            kind: "list",
            items: [
              `${m.llc.razonSocial}, our parent company in the United States, and its payment processor, when you pay by card: they receive the order data needed to process the charge (name, email, billing address and amount).`,
              "The carrier, to deliver your order.",
              "The providers of services we need to run the store: platform hosting, email delivery and image storage.",
            ],
          },
          {
            kind: "p",
            text: "Some of these recipients are in the United States. By accepting this policy you authorize that international data transfer, made for the same purposes and with the same safeguards described here, under article 26 of Colombian Law 1581 of 2012.",
          },
        ],
      },
      {
        id: "derechos",
        heading: "Your rights",
        summary: "You can access, update, correct and delete your data, and withdraw your consent, free of charge and at any time.",
        blocks: [
          { kind: "p", text: "Colombian Law 1581 of 2012 grants you, at any time and free of charge, the right to:" },
          {
            kind: "list",
            items: [
              "Know what data of yours we hold and how we use it.",
              "Update or correct it when it is incomplete or wrong.",
              "Request its deletion, unless there is a legal or contractual duty to keep it.",
              "Withdraw the consent you gave us.",
              "Be informed, on request, of how your data has been used.",
              "File complaints with the Superintendence of Industry and Commerce (SIC).",
            ],
          },
          {
            kind: "p",
            text: `To exercise any of them, write to ${m.email} with your name and the right you want to exercise. The process and deadlines are in the section "How to submit inquiries and claims".`,
          },
          {
            kind: "note",
            text: "Please note that if you ask us to delete your data, you will lose access to your order history and the Kora Cashback balance linked to your account. We will only keep the sales information that the law requires us to keep for accounting and tax purposes.",
          },
        ],
      },
      {
        id: "procedimiento",
        heading: "How to submit inquiries and claims",
        summary: "By email or WhatsApp. Inquiries: 10 business days. Claims: 15 business days. Free of charge.",
        blocks: [
          {
            kind: "p",
            text: `You, your successors, your representative or your attorney may submit them free of charge by writing to ${m.email} or via WhatsApp. The request must include the data subject's name, what you are asking for, an address or email for our answer and, if applicable, any supporting documents.`,
          },
          {
            kind: "list",
            items: [
              "Inquiries (knowing what data we hold and how we use it): we answer within ten (10) business days of receipt. If that is not possible, we explain why and answer within no more than five (5) additional business days.",
              "Claims (correcting, updating or deleting data, revoking authorization or reporting a breach): we answer within fifteen (15) business days of receipt. If that is not possible, we explain why and answer within no more than eight (8) additional business days.",
              "If a claim is incomplete, we ask you to complete it within the following five (5) days. If two (2) months pass without completing it, it is considered withdrawn.",
              "While we resolve a complete claim, we mark your data as \"claim in progress\" within no more than two (2) business days.",
            ],
          },
          {
            kind: "p",
            text: "Once this process is exhausted, you may go to Colombia's Superintendence of Industry and Commerce.",
          },
        ],
      },
      {
        id: "conservacion",
        heading: "How long we keep it",
        summary: "As long as we need it to serve you and for the periods required by law.",
        blocks: [
          { kind: "p", text: "We keep your data while you have an active account or while it is needed for the purposes described. After that, only for the periods required by applicable accounting, tax and commercial rules." },
        ],
      },
      {
        id: "seguridad",
        heading: "Security",
        summary: "Encrypted connection, restricted access and no card data in our systems.",
        blocks: [
          {
            kind: "p",
            text: "We apply reasonable technical and administrative measures to protect your data: every connection to the store is encrypted, access to the admin panel is restricted by permissions, and passwords are stored encrypted, never in plain text. Details about card payments are in our payment security policy.",
          },
          { kind: "p", text: "No system is infallible. If an incident affecting your personal data ever occurs, we log it, take measures to contain it, report it to the Superintendence of Industry and Commerce within fifteen (15) business days of detection, and inform you when it may significantly affect you." },
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        summary: c?.medicion
          ? "We use necessary cookies and, only if you accept them, analytics and advertising cookies."
          : "We only use cookies the store needs to work.",
        blocks: c?.medicion
          ? [
              {
                kind: "p",
                text: "We use necessary cookies to make the store work and, only if you accept them in the cookie notice, analytics and advertising cookies from partners that help us improve the store and measure our advertising. When we confirm an order from someone who accepted them, we tell those partners the purchase happened, with contact details irreversibly hashed. Some of them are in the United States.",
              },
              {
                kind: "p",
                text: "Details on which cookies we use, why, and how to accept, reject or delete them are in our Cookie policy.",
              },
            ]
          : [
              {
                kind: "p",
                text: "This store only uses strictly necessary cookies: keeping you signed in, remembering the currency and language you chose and keeping the products in your cart. We do not use advertising or third-party tracking cookies, and we do not profile your browsing behavior.",
              },
            ],
      },
      {
        id: "cambios-politica",
        heading: "Changes to this policy",
        summary: "We publish every version with its date and notify you of significant changes.",
        blocks: [
          { kind: "p", text: "If we change this policy we will publish the new version on this page with its update date. When a change substantially affects the purposes of processing, we will notify you before applying it." },
          { kind: "p", text: "This policy is in force from the update date shown at the top. Data is processed for as long as needed for the purposes described; once authorization is revoked, it is deleted unless a legal or contractual obligation requires keeping it, in which case we will let you know." },
        ],
      },
    ],
  }),
};
