// Guard de las pantallas de la cuenta.
// Ver openspec/changes/cuenta-comprador — specs/buyer-account.

import { redirect } from "next/navigation";
import { type BuyerSessionUser } from "./session";
import { currentBuyer } from "./session-cookie";

/**
 * Exige sesión de comprador. Sin ella, a la pantalla de acceso.
 *
 * Toda consulta de la cuenta debe partir de LO QUE ESTO DEVUELVE, nunca de un
 * identificador que venga en la dirección o en un formulario. La pregunta que
 * hay que hacerse en cada consulta no es "¿existe este pedido?" sino "¿es de
 * quien está preguntando?": es el fallo más común de un área privada y el más
 * fácil de evitar.
 */
export async function requireBuyer(volverA?: string): Promise<BuyerSessionUser> {
  const buyer = await currentBuyer();
  if (!buyer) {
    const destino = volverA ? `?volver=${encodeURIComponent(volverA)}` : "";
    redirect(`/cuenta/entrar${destino}`);
  }
  return buyer;
}
