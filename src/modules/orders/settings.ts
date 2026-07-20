// Números de WhatsApp destino, por moneda del pedido (PED_HU002 §2).
// Viven en `settings` para que se editen sin desplegar: cambiarlos es
// `pnpm whatsapp:set <numero>`, no un cambio de código.
//
// ⚠️ FASE DE PRUEBAS (19 jul 2026): los pedidos llegan al WhatsApp de Daniel
// (+57 314 275 1611) para poder gestionar el envío durante las pruebas.
// ANTES DE PUBLICAR hay que cambiarlo por la línea comercial real de KORA,
// que el cliente todavía no ha confirmado.
import { db } from "@/lib/db";
import type { Currency } from "@/modules/pricing";

export const WHATSAPP_KEYS = {
  COP: "whatsapp.co",
  USD: "whatsapp.us",
} as const;

/** Destino de pruebas. La base manda sobre esto si tiene la clave puesta. */
const DEFAULTS: Record<Currency, string> = {
  COP: "+573142751611",
  USD: "+573142751611", // sin línea de EE.UU. todavía: cae a la de Colombia
};

export async function whatsappNumberFor(currency: Currency): Promise<string> {
  const setting = await db.setting.findUnique({
    where: { key: WHATSAPP_KEYS[currency] },
  });
  const value = setting?.value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return DEFAULTS[currency];
}
