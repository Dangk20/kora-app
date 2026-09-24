// Números de WhatsApp destino, por moneda del pedido (PED_HU002 §2).
// Viven en `settings` para que se editen sin desplegar: cambiarlos es
// `pnpm whatsapp:set <numero>`, no un cambio de código.
//
// La línea comercial de KORA (+57 302 445 6290, confirmada por el cliente el
// 23 sep 2026) es el valor por omisión en PRODUCCIÓN: así un despliegue nuevo
// no depende de que alguien recuerde correr el script para que los pedidos
// lleguen al negocio. Pruebas y desarrollo siguen cayendo al WhatsApp de Daniel
// (+57 314 275 1611), para que un pedido de prueba no le llegue al cliente.
import { db } from "@/lib/db";
import { esProduccion } from "@/lib/environment";
import type { Currency } from "@/modules/pricing";

export const WHATSAPP_KEYS = {
  COP: "whatsapp.co",
  USD: "whatsapp.us",
} as const;

/** La base manda sobre esto si tiene la clave puesta. Sin línea de EE.UU.:
 *  los pedidos en USD caen a la de Colombia. */
const LINEA_KORA = "+573024456290";
const LINEA_PRUEBAS = "+573142751611";

export function defaultWhatsappNumber(env: NodeJS.ProcessEnv = process.env): string {
  return esProduccion(env) ? LINEA_KORA : LINEA_PRUEBAS;
}

export async function whatsappNumberFor(currency: Currency): Promise<string> {
  const setting = await db.setting.findUnique({
    where: { key: WHATSAPP_KEYS[currency] },
  });
  const value = setting?.value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return defaultWhatsappNumber();
}
