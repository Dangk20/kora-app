// El pedido que ya existe y que el comprador todavía no envió por WhatsApp.
//
// POR QUÉ EXISTE (31 ago 2026, encontrado probando):
//
// El pedido se crea en el servidor y, hasta ahora, el carrito se vaciaba en
// ese mismo instante — antes de que el comprador viera absolutamente nada: la
// pantalla de proceso todavía se estaba contando. Un clic de "atrás" en esa
// ventana —un misclic, un gesto del trackpad— dejaba al comprador con el
// carrito vacío y un pedido creado que jamás vio. Desde su lado, todo se
// desvaneció y no sabe si compró o no. Desde el lado del negocio, hay un
// pedido pendiente que nadie va a enviar.
//
// Ahora el carrito sobrevive hasta el puente de WhatsApp, y este registro es
// lo que impide que el pedido ya creado se vuelva invisible: mientras esté
// aquí, el checkout ofrece volver a él en vez de dejar que se cree otro.
//
// Vive en el navegador, junto al carrito, y NO es la fuente de verdad de
// nada: el pedido real está en la base. Es solo un hilo para volver.

import type { CartLine } from "./cart-context";

const CLAVE = "kora_pedido_sin_enviar";

/** La vigencia del propio pedido pendiente (2 h). Pasada, ya no sirve. */
const VIGENCIA_MS = 2 * 60 * 60 * 1000;

export type PedidoSinEnviar = {
  orderNumber: string;
  whatsappUrl: string;
  /** Marca de tiempo de creación, para no ofrecer un pedido ya vencido. */
  creadoEn: number;
  /**
   * De qué carrito salió este pedido.
   *
   * Sirve para una sola decisión, y es una que se puede hacer mal en las dos
   * direcciones: al enviar el pedido desde el aviso de rescate, ¿se vacía el
   * carrito? Sí **solo si sigue siendo el mismo carrito**. Si el comprador
   * volvió atrás y le añadió cosas, vaciarlo le borraría productos que nunca
   * pidió; y no vaciarlo cuando sí coincide le deja pidiendo dos veces lo
   * mismo. Sin esta huella habría que elegir un error fijo.
   */
  huella?: string;
};

/**
 * Identidad del contenido del carrito. Ordenada, para que el mismo carrito
 * armado en distinto orden dé la misma huella.
 */
export function huellaDeCarrito(lines: CartLine[]): string {
  return lines
    .map((l) => `${l.variantId}:${l.qty}`)
    .sort()
    .join("|");
}

export function recordarPedidoSinEnviar(
  pedido: Omit<PedidoSinEnviar, "creadoEn">,
): void {
  try {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify({ ...pedido, creadoEn: Date.now() }),
    );
  } catch {
    // Incógnito con almacenamiento bloqueado: se pierde el hilo de vuelta,
    // pero el pedido sigue existiendo en la base y el operador lo ve igual.
  }
}

export function leerPedidoSinEnviar(): PedidoSinEnviar | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const p: unknown = JSON.parse(crudo);
    if (
      typeof p !== "object" ||
      p === null ||
      typeof (p as PedidoSinEnviar).orderNumber !== "string" ||
      typeof (p as PedidoSinEnviar).whatsappUrl !== "string" ||
      typeof (p as PedidoSinEnviar).creadoEn !== "number"
    ) {
      return null;
    }
    const pedido = p as PedidoSinEnviar;
    // Vencido: ofrecer volver a un pedido que ya expiró sería mandar al
    // comprador a una conversación sobre algo que el panel ya descartó.
    if (Date.now() - pedido.creadoEn > VIGENCIA_MS) {
      olvidarPedidoSinEnviar();
      return null;
    }
    return pedido;
  } catch {
    return null;
  }
}

export function olvidarPedidoSinEnviar(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer: el registro es una comodidad, no un dato del negocio.
  }
}
