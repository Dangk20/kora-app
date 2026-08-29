// Qué dice cada correo del pedido.
// Ver openspec/changes/correos-transaccionales — specs/transactional-email.
//
// Solo redacta: no consulta la base ni decide si se envía. Así se puede probar
// el texto sin fabricar un pedido, y quien lea este archivo ve de un vistazo
// todo lo que KORA le dice a un comprador.

import { ORDER_TTL_HOURS } from "@/modules/orders/status";
import type { OrderEmailType } from "@/generated/prisma/enums";
import { renderCampaign, type TemplateOrder } from "@/modules/email/template";
import { storeUrl } from "@/modules/email/driver";
import { formatMoney } from "@/modules/pricing";

export type OrderEmailData = {
  orderNumber: string;
  orderId: string;
  buyerName: string | null;
  whatsappUrl: string | null;
  order: TemplateOrder;
  /** Cashback acreditado al confirmar, si lo hubo. */
  cashbackEarned?: number;
  cashbackExpiresAt?: Date | null;
  /** Cashback devuelto al cancelar, si lo hubo. */
  cashbackRefunded?: number;
  /** Motivo, cuando el pedido se canceló o expiró. */
  cancelReason?: "EXPIRED" | "CANCELLED";
  /** Horas que le quedan al pedido. Solo para el recordatorio de pago. */
  hoursLeft?: number;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeZone: "America/Bogota",
  }).format(d);

function base(
  data: OrderEmailData,
  parts: { subject: string; title: string; body: string; preheader: string; cta?: { label: string; url: string } | null; notes?: string[] },
): RenderedEmail {
  const { html, text } = renderCampaign({
    subject: parts.subject,
    preheader: parts.preheader,
    title: parts.title,
    body: parts.body,
    products: [],
    // Vacío A PROPÓSITO: un comprobante no ofrece darse de baja.
    unsubscribeUrl: "",
    recipientName: data.buyerName,
    ctaLabel: parts.cta?.label ?? null,
    ctaUrl: parts.cta?.url ?? null,
    order: { ...data.order, notes: parts.notes ?? [] },
  });
  return { subject: parts.subject, html, text };
}

export function renderOrderEmail(type: OrderEmailType, data: OrderEmailData): RenderedEmail {
  const c = data.order.currency;

  switch (type) {
    case "BUYER_CREATED":
      return base(data, {
        subject: `Recibimos tu pedido ${data.orderNumber}`,
        preheader: "Continúa por WhatsApp para confirmar tu pago.",
        title: "Ya tenemos tu pedido",
        // El pago ocurre FUERA de la plataforma: sin este enlace, quien cerró
        // la pestaña no tiene forma de volver, y el pedido expira.
        //
        // ⚠️ El plazo se DERIVA de ORDER_TTL_HOURS, nunca se escribe a mano.
        // Estuvo escrito ("2 horas") y el 27 ago 2026 la vigencia pasó a 24 h:
        // durante unas horas estos correos le prometieron al comprador un plazo
        // que el sistema ya no cumplía. Es la misma trampa que la página de
        // términos, en un sitio donde además el texto ya salió por correo y no
        // se puede corregir después.
        body:
          "Gracias por comprar en KORA. Tu pedido quedó reservado y el pago se acuerda por " +
          "WhatsApp: escríbenos con el botón de abajo y lo confirmamos contigo.\n\n" +
          `Si no lo confirmas dentro de las próximas ${ORDER_TTL_HOURS} horas, el pedido se ` +
          "cancela solo y los productos vuelven a quedar disponibles.",
        cta: data.whatsappUrl
          ? { label: "Continuar por WhatsApp", url: data.whatsappUrl }
          : null,
      });

    case "BUYER_CONFIRMED": {
      const notes: string[] = [];
      if (data.cashbackEarned && data.cashbackEarned > 0) {
        notes.push(
          `Ganaste ${formatMoney(data.cashbackEarned, c)} de Kora Cashback` +
            (data.cashbackExpiresAt
              ? `, disponible hasta el ${fecha(data.cashbackExpiresAt)}.`
              : "."),
        );
      }
      return base(data, {
        subject: `Confirmamos el pago de tu pedido ${data.orderNumber}`,
        preheader: "Ya lo estamos preparando.",
        title: "Pago confirmado",
        body:
          "Recibimos tu pago y tu pedido ya está en proceso. Te avisamos apenas salga hacia " +
          "tu dirección.",
        cta: { label: "Ver mi pedido", url: `${storeUrl()}/cuenta` },
        notes,
      });
    }

    case "BUYER_PREPARING":
      return base(data, {
        subject: `Estamos preparando tu pedido ${data.orderNumber}`,
        preheader: "Ya lo estamos armando.",
        title: "Manos a la obra",
        body:
          "Tu pedido ya está en preparación: lo estamos armando y revisando antes de " +
          "despacharlo. Te escribimos otra vez en cuanto salga.",
        cta: { label: "Ver mi pedido", url: `${storeUrl()}/cuenta` },
      });

    case "BUYER_SHIPPED":
      return base(data, {
        subject: `Tu pedido ${data.orderNumber} va en camino`,
        preheader: "Ya salió hacia tu dirección.",
        title: "Tu pedido va en camino",
        body:
          "Tu pedido salió hacia la dirección que nos diste. Si necesitas coordinar la " +
          "entrega, escríbenos por WhatsApp y lo vemos.",
        cta: data.whatsappUrl ? { label: "Escribirnos", url: data.whatsappUrl } : null,
      });

    case "BUYER_DELIVERED": {
      const notes: string[] = [];
      if (data.cashbackEarned && data.cashbackEarned > 0) {
        notes.push(
          `Tienes ${formatMoney(data.cashbackEarned, c)} de Kora Cashback de esta compra` +
            (data.cashbackExpiresAt
              ? `, disponible hasta el ${fecha(data.cashbackExpiresAt)}.`
              : "."),
        );
      }
      // La ventana de cambios es de 30 días y se cuenta desde la compra. Si no
      // se la recordamos aquí, el comprador se entera cuando ya pasó.
      notes.push(
        "Si necesitas cambiar el producto, tienes 30 días calendario desde tu compra: debe " +
          "estar nuevo, con sus etiquetas y su empaque original.",
      );
      return base(data, {
        subject: `Tu pedido ${data.orderNumber} fue entregado`,
        preheader: "Gracias por comprar en KORA.",
        title: "Tu pedido llegó",
        body:
          "Tu pedido fue entregado. Gracias por comprar en KORA — si algo no está como " +
          "esperabas, escríbenos por WhatsApp y lo resolvemos.",
        cta: data.whatsappUrl ? { label: "Escribirnos", url: data.whatsappUrl } : null,
        notes,
      });
    }

    case "BUYER_CANCELLED": {
      const expirado = data.cancelReason === "EXPIRED";
      const notes: string[] = [];
      if (data.cashbackRefunded && data.cashbackRefunded > 0) {
        // Es dinero suyo: decirlo evita que crea que lo perdió.
        notes.push(
          `Devolvimos ${formatMoney(data.cashbackRefunded, c)} de Kora Cashback a tu saldo.`,
        );
      }
      return base(data, {
        subject: `Tu pedido ${data.orderNumber} fue cancelado`,
        preheader: expirado ? "Puedes volver a armarlo cuando quieras." : "Cualquier duda, escríbenos.",
        title: expirado ? "Tu pedido expiró" : "Tu pedido fue cancelado",
        body: expirado
          ? `Tu pedido se canceló porque pasaron las ${ORDER_TTL_HOURS} horas sin confirmar ` +
            "el pago, y los productos volvieron a quedar disponibles. Si todavía lo quieres, " +
            "puedes armarlo de nuevo en la tienda."
          : "Tu pedido fue cancelado. Si crees que fue un error o quieres retomarlo, " +
            "escríbenos por WhatsApp.",
        cta: { label: "Volver a la tienda", url: storeUrl() },
        notes,
      });
    }

    case "BUYER_PAYMENT_REMINDER": {
      // El ÚNICO correo que no nace de un cambio de estado: el pedido sigue
      // pendiente y sin embargo hay algo que decir. Petición del cliente del
      // 7 ago 2026.
      //
      // El tono importa más aquí que en los otros seis. Quien recibe esto no
      // hizo nada mal: dejó una compra a medias, que es lo más normal del
      // mundo. Un recordatorio que suene a reclamo consigue que no vuelva.
      const restante = data.hoursLeft ?? 1;
      const cuanto = restante <= 1 ? "menos de una hora" : `${restante} horas`;

      return base(data, {
        subject: `Tu pedido ${data.orderNumber} está por vencer`,
        preheader: "Todavía puedes confirmarlo por WhatsApp.",
        title: "Tu pedido sigue esperándote",
        body:
          `Dejaste este pedido listo y todavía no hemos cerrado el pago. Te quedan ` +
          `${cuanto} para confirmarlo por WhatsApp.\n\n` +
          "Si ya no lo quieres no tienes que hacer nada: se cancela solo y los productos " +
          "vuelven a quedar disponibles.",
        cta: data.whatsappUrl
          ? { label: "Confirmar por WhatsApp", url: data.whatsappUrl }
          : { label: "Volver a la tienda", url: storeUrl() },
      });
    }

    case "STAFF_NEW_ORDER":
      return base(data, {
        // El operador tiene la vigencia entera antes de que el pedido expire:
        // el asunto dice lo que necesita para decidir si atiende ahora.
        subject: `Pedido nuevo ${data.orderNumber} · ${formatMoney(data.order.total, c)} ${c}`,
        preheader: "Confírmalo en el panel antes de que expire.",
        title: "Entró un pedido",
        body:
          `${data.buyerName ?? "Un comprador"} acaba de hacer un pedido. Está pendiente de ` +
          `confirmación y expira en ${ORDER_TTL_HOURS} horas si nadie lo atiende.`,
        cta: { label: "Abrir el pedido", url: `${storeUrl()}/admin/pedidos/${data.orderId}` },
      });
  }
}
