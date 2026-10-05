"use server";

// Buscar el pedido propio sin tener cuenta (alcance §1.9).

import { redirect } from "next/navigation";
import { getMessages } from "@/modules/i18n/server";
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
  // Traducido en el borde y para los DOS casos con la misma frase: siguen
  // sin distinguirse desde fuera, en cualquier idioma.
  const noEncontrado = (await getMessages()).errores.traducir(TRACKING_NOT_FOUND);
  if (numero === null || !contacto) return { error: noEncontrado };

  const pedido = await findOrderForTracking(numero, contacto);
  if (!pedido) return { error: noEncontrado };

  // A partir de aquí el derecho a ver el pedido ya está demostrado, y viaja
  // firmado: el contacto no entra en la URL, así que no queda en el historial
  // del navegador, ni en los registros del servidor, ni en la cabecera
  // `Referer` de ningún recurso externo.
  redirect(`/pedido/${numero}?t=${encodeURIComponent(trackingToken(pedido.id))}`);
}
