// Acreditación de Kora Cashback al confirmar un pedido.
// Ver openspec/changes/kora-cashback — specs/cashback-accrual.
//
// ⚠️ ESTE MANEJADOR ACREDITA DINERO. La entrega de la bandeja de salida es
// *al menos una vez*: un evento puede llegar dos veces porque el proceso murió
// tras aplicar el efecto o porque otro manejador del mismo evento falló y se
// reintentó el evento completo. Duplicar aquí es regalar saldo, y es un error
// que nadie reporta — nadie se queja de que le den de más.
//
// La idempotencia se comprueba contra EL PROPIO LIBRO: ¿ya existe un lote de
// este pedido? Una marca aparte en el pedido sería un segundo estado que puede
// desincronizarse: si se escribiera la marca y fallara el movimiento, el
// cashback no existiría y el sistema creería que sí.

import { db } from "@/lib/db";
import { computeAccrual } from "@/modules/cashback/accrual";
import { creditCashback } from "@/modules/cashback/ledger";
import { aNumero } from "@/modules/cashback/money";
import type { DomainEventRecord, EventHandler } from "../types";

type OrderConfirmedPayload = { orderId?: unknown };

/** Deja constancia de por qué NO se acreditó, en vez de fallar en silencio. */
async function anotar(orderId: string, status: string, nota: string): Promise<void> {
  const ya = await db.orderStatusHistory.findFirst({
    where: { orderId, note: nota },
    select: { id: true },
  });
  if (ya) return;
  // `from` = `to`: es una anotación, no una transición. El worker NUNCA mueve
  // el estado de un pedido — eso solo pasa por `canTransition()`.
  await db.orderStatusHistory.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el estado viene del pedido, no se inventa
    data: { orderId, from: status as any, to: status as any, note: nota },
  });
}

export const orderConfirmedCashbackHandler: EventHandler = {
  name: "order-confirmed-cashback",

  async handle(event: DomainEventRecord): Promise<void> {
    const payload = (event.payload ?? {}) as OrderConfirmedPayload;
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;

    if (!orderId) {
      // Un evento sin pedido es un error de quien lo emitió; reintentar no lo
      // arregla. Lanzar hace que agote intentos y quede visible en el
      // diagnóstico, que es donde debe verse.
      throw new Error(`order.confirmed sin orderId utilizable (evento ${event.id})`);
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, total: true, currency: true, customerId: true },
    });
    if (!order) throw new Error(`El pedido ${orderId} no existe (evento ${event.id})`);

    // ── Idempotencia: el rastro está en el libro ──
    // Esta comprobación evita el trabajo; la GARANTÍA la da el índice único
    // parcial `cashback_un_lote_por_pedido` (ver la migración). Dos eventos del
    // mismo pedido tomados a la vez por dos trabajadores verían ambos "no
    // existe": leer no es reservar.
    if (await yaTieneLote(orderId)) return;

    // El cashback pertenece a alguien: un lote sin dueño es dinero que no se
    // puede reclamar ni auditar. Y como todo pedido de la tienda crea o
    // reconoce a su cliente, encontrarse uno sin él es señal de que algo va mal
    // aguas arriba: hay que verlo, no ignorarlo.
    if (!order.customerId) {
      await anotar(orderId, order.status, "cashback: no acreditado — pedido sin cliente asociado");
      return;
    }

    // Hoy `cashbackApplied` es 0 siempre: la redención en el checkout es un
    // change aparte. Cuando exista, el pedido guardará cuánto se pagó con saldo
    // y entrará por aquí.
    const amount = computeAccrual({ total: aNumero(order.total), currency: order.currency });

    if (amount <= 0) {
      await anotar(
        orderId,
        order.status,
        "cashback: no acreditado — la compra no dejó valor pagado con dinero",
      );
      return;
    }

    try {
      await db.$transaction((tx) =>
        creditCashback(tx, {
          customerId: order.customerId as string,
          amount,
          currency: order.currency,
          orderId,
        }),
      );
    } catch (e) {
      // Si el índice único rechazó la escritura, otro trabajador acreditó este
      // pedido mientras tanto: el resultado es exactamente el que se buscaba.
      // Que la carrera termine en éxito silencioso y no en reintento es lo que
      // hace que el manejador sea idempotente de verdad y no solo de palabra.
      if (esLoteDuplicado(e)) return;
      throw e;
    }
  },
};

async function yaTieneLote(orderId: string): Promise<boolean> {
  const lote = await db.cashbackMovement.findFirst({
    where: { orderId, type: "EARN" },
    select: { id: true },
  });
  return lote !== null;
}

function esLoteDuplicado(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}
