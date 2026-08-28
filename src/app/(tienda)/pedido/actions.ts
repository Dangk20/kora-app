"use server";

// Buscar el pedido propio sin tener cuenta (alcance §1.9).

import { redirect } from "next/navigation";
import {
  TRACKING_NOT_FOUND,
  findOrderForTracking,
  parseOrderNumber,
  trackingToken,
} from "@/modules/orders/tracking";

export type BuscarResult = { error: string } | undefined;

export async function buscarPedido(
  _previo: BuscarResult,
  form: FormData,
): Promise<BuscarResult> {
  const numero = parseOrderNumber(String(form.get("numero") ?? ""));
  const contacto = String(form.get("contacto") ?? "").trim();

  // El mismo mensaje para todo: desde fuera, un formato inválido y un pedido
  // inexistente no se distinguen. Ver TRACKING_NOT_FOUND.
  if (numero === null || !contacto) return { error: TRACKING_NOT_FOUND };

  const pedido = await findOrderForTracking(numero, contacto);
  if (!pedido) return { error: TRACKING_NOT_FOUND };

  // A partir de aquí el derecho a ver el pedido ya está demostrado, y viaja
  // firmado: el contacto no entra en la URL, así que no queda en el historial
  // del navegador, ni en los registros del servidor, ni en la cabecera
  // `Referer` de ningún recurso externo.
  redirect(`/pedido/${numero}?t=${encodeURIComponent(trackingToken(pedido.id))}`);
}
