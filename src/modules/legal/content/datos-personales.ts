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
// La versión SIN medición no cambió desde el centro legal: conserva su fecha.
const ACTUALIZADO_SIN_MEDICION = "2026-10-10";

export const datosPersonales: BilingualDocument = {
  es: (m, c) => ({
    slug: "datos-personales",
    title: "Política de privacidad y tratamiento de datos personales",
    shortTitle: "Privacidad y tratamiento de datos",
    summary: "Quién trata tus datos, para qué, con quién se comparten y qué puedes exigir en cualquier momento.",
    updatedAt: c?.medicion ? ACTUALIZADO : ACTUALIZADO_SIN_MEDICION,
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
            text: `Para ejercer cualquiera de ellos escribe a ${m.email} indicando tu nombre y el derecho que quieres ejercer. Respondemos las consultas en un máximo de diez (10) días hábiles y los reclamos en un máximo de quince (15) días hábiles, contados desde que recibimos la solicitud. Si necesitamos más tiempo te explicaremos por qué y cuándo tendrás respuesta.`,
          },
          {
            kind: "note",
            text: "Ten en cuenta que si pides eliminar tus datos, perderás el acceso a tu historial de pedidos y el saldo de Kora Cashback asociado a tu cuenta. Conservaremos únicamente la información de las ventas que la ley nos obliga a guardar por razones contables y tributarias.",
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
            text: "Ningún sistema es infalible. Si llegara a ocurrir un incidente que afecte tus datos personales, te informaremos y lo reportaremos a la autoridad conforme a la ley.",
          },
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        summary: c?.medicion
          ? "Usamos cookies necesarias para que la tienda funcione y, solo si lo autorizas, cookies de medición de Meta, Google y Microsoft Clarity."
          : "Solo usamos cookies necesarias para que la tienda funcione.",
        blocks: c?.medicion
          ? [
              {
                kind: "p",
                text: "Usamos cookies estrictamente necesarias para que la tienda funcione: mantener tu sesión iniciada, recordar la moneda y el idioma que elegiste, conservar los productos de tu carrito, guardar tu elección sobre cookies y registrar de qué campaña o enlace llegaste a la tienda.",
              },
              {
                kind: "p",
                text: "Solo si lo autorizas en el aviso de cookies, usamos además cookies de medición de Meta Platforms (Facebook e Instagram), de Google (Google Analytics y Google Ads) y de Microsoft Clarity, con estas finalidades:",
              },
              {
                kind: "list",
                items: [
                  "Medir qué anuncios y publicaciones llevan a una compra.",
                  "Informar a esas plataformas, cuando confirmamos tu pedido, que la compra ocurrió y por qué valor, para que nuestros anuncios lleguen a personas con intereses parecidos.",
                  "Mostrarte anuncios de KORA más relevantes en esas plataformas.",
                  "Entender cómo se usa la tienda —en qué se hace clic, hasta dónde se desplaza la página, dónde se atasca la compra— para mejorarla. Microsoft Clarity graba la navegación de forma anónima y oculta lo que escribes en los formularios.",
                ],
              },
              {
                kind: "p",
                text: "Al confirmar tu pedido les enviamos tu correo, teléfono, nombre y ciudad cifrados de forma irreversible (SHA-256), junto con la dirección IP y el navegador desde los que compraste, únicamente para que puedan reconocer la compra. Estas plataformas están en Estados Unidos y tratan esos datos conforme a sus propias políticas.",
              },
              {
                kind: "p",
                text: "Si eliges «Solo necesarias», no cargamos ninguna de esas cookies ni enviamos tus datos de compra a ninguna plataforma. Puedes cambiar tu elección en cualquier momento desde «Preferencias de cookies», al pie de la tienda.",
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
        ],
      },
    ],
  }),

  en: (m, c) => ({
    slug: "datos-personales",
    title: "Privacy and Personal Data Policy",
    shortTitle: "Privacy policy",
    summary: "Who processes your data, for what, with whom it is shared, and what you can request at any time.",
    updatedAt: c?.medicion ? ACTUALIZADO : ACTUALIZADO_SIN_MEDICION,
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
            text: `To exercise any of them, write to ${m.email} with your name and the right you want to exercise. We answer inquiries within ten (10) business days and claims within fifteen (15) business days from receipt. If we need more time we will explain why and when you will get an answer.`,
          },
          {
            kind: "note",
            text: "Please note that if you ask us to delete your data, you will lose access to your order history and the Kora Cashback balance linked to your account. We will only keep the sales information that the law requires us to keep for accounting and tax purposes.",
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
          { kind: "p", text: "No system is infallible. If an incident affecting your personal data ever occurs, we will inform you and report it to the authority as required by law." },
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        summary: c?.medicion
          ? "We use cookies the store needs to work and, only with your permission, Meta, Google and Microsoft Clarity measurement cookies."
          : "We only use cookies the store needs to work.",
        blocks: c?.medicion
          ? [
              {
                kind: "p",
                text: "We use strictly necessary cookies to make the store work: keeping you signed in, remembering the currency and language you chose, keeping the products in your cart, saving your cookie choice and recording which campaign or link brought you to the store.",
              },
              {
                kind: "p",
                text: "Only if you allow it in the cookie notice, we also use measurement cookies from Meta Platforms (Facebook and Instagram), Google (Google Analytics and Google Ads) and Microsoft Clarity, for these purposes:",
              },
              {
                kind: "list",
                items: [
                  "Measuring which ads and posts lead to a purchase.",
                  "Telling those platforms, when we confirm your order, that the purchase happened and its value, so our ads reach people with similar interests.",
                  "Showing you more relevant KORA ads on those platforms.",
                  "Understanding how the store is used —what gets clicked, how far pages are scrolled, where checkout gets stuck— to improve it. Microsoft Clarity records browsing anonymously and hides what you type in forms.",
                ],
              },
              {
                kind: "p",
                text: "When we confirm your order we send them your email, phone, name and city irreversibly hashed (SHA-256), together with the IP address and browser you purchased from, solely so they can recognize the purchase. These platforms are in the United States and process that data under their own policies.",
              },
              {
                kind: "p",
                text: "If you choose \"Necessary only\", we load none of those cookies and send your purchase data to no platform. You can change your choice at any time from \"Cookie preferences\" at the bottom of the store.",
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
        ],
      },
    ],
  }),
};
