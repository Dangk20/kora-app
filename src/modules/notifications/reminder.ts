// El recordatorio de pago: el octavo correo, y el único que no nace de un
// cambio de estado.
//
// Petición del cliente del 7 ago 2026. A una hora de que el pedido expire, el
// estado sigue siendo PENDING —no ha cambiado nada— y sin embargo hay algo que
// decirle al comprador. Por eso esto no cuelga de `EVENTO_POR_ESTADO` como los
// otros siete, sino de un trabajo programado que va a buscarlos.
//
// ── La ventana, que es la decisión que importa ────────────────────────────
//
// Se ancla en `expiresAt`, NO en `createdAt`. Es tentador escribir "pedidos
// creados hace más de 23 horas", y es un error de dos maneras:
//
//   · Repite la vigencia. Si mañana el cliente pide 48 h, ese 23 se queda
//     obsoleto en silencio y el recordatorio empieza a llegar a mitad de la
//     ventana, sin que nada falle ni avise. Es la misma trampa que ya se pagó
//     con el plazo escrito a mano en las plantillas.
//   · Ignora que `expiresAt` es la verdad. El pedido guarda su propio
//     vencimiento; deducirlo de la fecha de creación es reconstruir un dato
//     que ya está ahí.
//
// Anclado en el vencimiento, "una hora antes de expirar" sigue siendo una hora
// antes aunque la vigencia cambie.
//
// ── Y por qué caer varias veces en la ventana no importa ──────────────────
//
// El trabajo corre cada pocos minutos, así que un mismo pedido entra en varias
// pasadas. No pasa nada: quien garantiza que el correo salga UNA vez es la
// reserva de `sendOrderEmail` —índice único `(pedido, tipo, destinatario)`—, no
// la ventana. El filtro de abajo es una optimización para no releer lo mismo,
// no la garantía. Leer no es reservar.

import { db } from "@/lib/db";
import { ORDER_TTL_MS } from "@/modules/orders/status";
import { whatsappNumberFor } from "@/modules/orders/settings";
import { whatsappUrl } from "@/modules/orders/message";
import { orderEmailContext } from "./order-data";
import { renderOrderEmail } from "./render";
import { sendOrderEmail } from "./send";

const HORA = 60 * 60_000;

/**
 * Cuánto antes del vencimiento se avisa.
 *
 * Una hora, que es lo que pidió el cliente con la vigencia de 24 h ("la hora
 * 23"). Pero acotado a la mitad de la vigencia: si alguien la bajara a 30
 * minutos, avisar "una hora antes" caería en el pasado y TODO pedido pendiente
 * entraría en la ventana desde el instante en que se crea. Derivarlo evita que
 * un cambio de configuración convierta el recordatorio en spam inmediato.
 */
export function leadTimeMs(ttlMs: number = ORDER_TTL_MS): number {
  return Math.min(HORA, Math.floor(ttlMs / 2));
}

export type ReminderResult = {
  /** Correos efectivamente entregados al proveedor. */
  sent: number;
  /** Ya se habían mandado antes: la reserva hizo su trabajo. */
  alreadySent: number;
  /** No se pudo escribir a esa persona (sin correo, dirección quemada…). */
  skipped: number;
  /** Números de pedido a los que se avisó en esta pasada. */
  numbers: string[];
};

/**
 * Avisa a los pedidos pendientes que están a punto de vencer.
 *
 * No cambia el estado de nada: un recordatorio no cancela ni confirma. Si el
 * comprador no responde, es `orders:expire` quien lo vence, como siempre.
 */
export async function sendPaymentReminders(now: Date = new Date()): Promise<ReminderResult> {
  const limite = new Date(now.getTime() + leadTimeMs());

  const pendientes = await db.order.findMany({
    where: {
      status: "PENDING",
      // Entre ahora y el límite: los que ya vencieron no se avisan —no tiene
      // sentido pedirle a alguien que confirme algo que ya expiró— y de eso se
      // encarga `orders:expire`.
      expiresAt: { gt: now, lte: limite },
      // Optimización, no garantía: saltarse los que ya tienen su fila evita
      // releer el mismo pedido en cada pasada. Si dos trabajadores miran a la
      // vez y ambos ven que no está, la reserva sigue impidiendo el duplicado.
      emailsSent: { none: { type: "BUYER_PAYMENT_REMINDER" } },
    },
    // `expiresAt` y `whatsappMessage` salen de aquí y no del contexto de
    // redacción: ese contexto existe para escribir el texto del correo, no para
    // decidir a quién y cuándo se le manda.
    select: {
      id: true,
      number: true,
      contactEmail: true,
      contactName: true,
      currency: true,
      expiresAt: true,
      whatsappMessage: true,
    },
    orderBy: { expiresAt: "asc" },
  });

  const r: ReminderResult = { sent: 0, alreadySent: 0, skipped: 0, numbers: [] };

  for (const p of pendientes) {
    const ctx = await orderEmailContext(p.id);
    if (!ctx) {
      // El pedido desapareció entre la consulta y ahora. No es un fallo del
      // recordatorio: se cuenta como omitido y se sigue con los demás.
      r.skipped += 1;
      continue;
    }

    const restanteMs = (p.expiresAt?.getTime() ?? now.getTime()) - now.getTime();
    const horas = Math.max(1, Math.round(restanteMs / HORA));

    const enlace = p.whatsappMessage
      ? whatsappUrl(await whatsappNumberFor(p.currency), p.whatsappMessage)
      : null;

    const salida = await sendOrderEmail({
      orderId: p.id,
      type: "BUYER_PAYMENT_REMINDER",
      to: p.contactEmail,
      toName: p.contactName,
      email: renderOrderEmail("BUYER_PAYMENT_REMINDER", {
        ...ctx,
        whatsappUrl: enlace,
        hoursLeft: horas,
      }),
    });

    if (salida.sent) {
      r.sent += 1;
      r.numbers.push(ctx.orderNumber);
    } else if (salida.reason === "YA_ENVIADO") {
      r.alreadySent += 1;
    } else if (salida.reason === "NO_ENVIABLE") {
      r.skipped += 1;
    } else {
      // Fallo del proveedor: se deja constancia y se sigue. NO se lanza — un
      // correo caído no puede impedir que los demás compradores reciban el
      // suyo, y la reserva quedó liberada para que la próxima pasada lo
      // reintente.
      r.skipped += 1;
    }
  }

  return r;
}
