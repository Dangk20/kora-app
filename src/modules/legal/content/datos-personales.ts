// Política de tratamiento de datos personales.
//
// Trazada a la Ley 1581 de 2012 y al Decreto 1377 de 2013. Es la política a la
// que apunta la casilla de autorización del checkout: hasta ahora esa casilla
// pedía consentimiento para un tratamiento que no estaba descrito en ninguna
// parte, y un consentimiento que no dice a qué se consiente no acredita nada.
//
// Las finalidades declaradas son las REALES del sistema, comprobables leyendo
// el código: gestionar el pedido, contactar por WhatsApp, acreditar cashback,
// enviar comprobantes de estado, y —solo con la casilla opcional marcada—
// campañas de marketing. No se listan finalidades genéricas "por si acaso":
// declarar más de lo que se hace es tan incorrecto como declarar menos.

import type { LegalDocumentFactory } from "./types";

export const datosPersonales: LegalDocumentFactory = (m) => ({
  slug: "datos-personales",
  title: "Política de tratamiento de datos personales",
  summary:
    "Quién trata tus datos, para qué, y qué puedes exigir en cualquier momento.",
  updatedAt: "2026-08-07",
  sections: [
    {
      heading: "Responsable del tratamiento",
      blocks: [
        {
          kind: "p",
          text: `${m.razonSocial}, identificada con NIT ${m.nit}, con domicilio en ${m.domicilio}, es la responsable del tratamiento de los datos personales recogidos a través de esta tienda y de sus canales de atención.`,
        },
        {
          kind: "p",
          text: `Para cualquier asunto relacionado con tus datos personales puedes escribir a ${m.email}.`,
        },
      ],
    },
    {
      heading: "Qué datos recogemos",
      blocks: [
        {
          kind: "p",
          text: "Únicamente los que necesitamos para venderte y atenderte:",
        },
        {
          kind: "list",
          items: [
            "Nombre y apellidos.",
            "Correo electrónico.",
            "Número de teléfono, para coordinar el pedido por WhatsApp.",
            "Dirección y ciudad de entrega.",
            "Historial de tus pedidos y de tu saldo de Kora Cashback.",
          ],
        },
        {
          kind: "p",
          text: "No pedimos ni almacenamos datos de tarjetas de crédito o débito: esta plataforma no procesa pagos. El cobro se coordina directamente contigo por WhatsApp.",
        },
        {
          kind: "note",
          text: "No recogemos datos sensibles ni datos de menores de edad. Si crees que nos has entregado alguno por error, escríbenos y lo eliminamos.",
        },
      ],
    },
    {
      heading: "Para qué los usamos",
      blocks: [
        {
          kind: "list",
          items: [
            "Registrar tu pedido y mantener el detalle de lo que compraste.",
            "Contactarte por WhatsApp para confirmar el pedido, coordinar el pago y acordar la entrega.",
            "Enviarte por correo electrónico el comprobante de cada cambio de estado de tu pedido: recibido, confirmado, en preparación, despachado, entregado, cancelado o vencido.",
            "Calcular y acreditar tu saldo de Kora Cashback, y avisarte de su vencimiento.",
            "Atender tus solicitudes de cambio, garantía o retracto.",
            "Cumplir obligaciones legales, contables y tributarias.",
          ],
        },
        {
          kind: "p",
          text: "Enviarte novedades, lanzamientos y promociones es una finalidad distinta y requiere tu autorización aparte: la casilla opcional del checkout, o la suscripción desde la tienda. Puedes retirarla cuando quieras sin afectar tus compras.",
        },
        {
          kind: "note",
          text: "Darte de baja de las comunicaciones comerciales no cancela los comprobantes de tus pedidos. Esos correos no son publicidad: son la constancia de lo que compraste y de lo que pagaste, y en una tienda donde el cobro se coordina por WhatsApp puede ser la única que tengas.",
        },
      ],
    },
    {
      heading: "Con quién los compartimos",
      blocks: [
        {
          kind: "p",
          text: "No vendemos, arrendamos ni cedemos tus datos personales a terceros con fines comerciales.",
        },
        {
          kind: "p",
          text: "Solo los tratan proveedores que nos prestan un servicio necesario para operar la tienda —alojamiento de la plataforma, envío de correo electrónico y almacenamiento de imágenes—, actuando como encargados del tratamiento, con instrucciones nuestras y sin autorización para usarlos para nada más.",
        },
      ],
    },
    {
      heading: "Tus derechos como titular",
      blocks: [
        {
          kind: "p",
          text: "La Ley 1581 de 2012 te reconoce, en cualquier momento y de forma gratuita:",
        },
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
      heading: "Cuánto tiempo los conservamos",
      blocks: [
        {
          kind: "p",
          text: "Conservamos tus datos mientras tengas una cuenta activa o mientras sigan siendo necesarios para las finalidades descritas. Después, únicamente durante los plazos que exigen las normas contables, tributarias y comerciales aplicables en Colombia.",
        },
      ],
    },
    {
      heading: "Seguridad",
      blocks: [
        {
          kind: "p",
          text: "Aplicamos medidas técnicas y administrativas razonables para proteger tus datos: el acceso al panel de administración está restringido por permisos, las contraseñas se almacenan cifradas y nunca en texto plano, y la conexión con la tienda viaja siempre cifrada.",
        },
        {
          kind: "p",
          text: "Ningún sistema es infalible. Si llegara a ocurrir un incidente que afecte tus datos personales, te informaremos y lo reportaremos a la autoridad conforme a la ley.",
        },
      ],
    },
    {
      heading: "Cookies",
      blocks: [
        {
          kind: "p",
          text: "Esta tienda usa únicamente cookies estrictamente necesarias para funcionar: mantener tu sesión iniciada, recordar la moneda que elegiste y conservar los productos de tu carrito. No usamos cookies de publicidad ni de seguimiento de terceros, y no perfilamos tu comportamiento de navegación.",
        },
      ],
    },
    {
      heading: "Cambios en esta política",
      blocks: [
        {
          kind: "p",
          text: "Si modificamos esta política publicaremos la nueva versión en esta misma página, con su fecha de actualización. Cuando el cambio afecte de forma sustancial las finalidades del tratamiento, te lo comunicaremos antes de aplicarlo.",
        },
      ],
    },
  ],
});
