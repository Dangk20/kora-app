// Supresión automática: la lista se limpia sola.
// Ver openspec/changes/email-marketing — specs/email-consent.
//
// Seguir enviando a direcciones que rebotan es la forma más rápida de que un
// proveedor clasifique el dominio como spam. Y una queja de spam es una
// petición de baja expresada de la peor manera posible: tratarla como tal es
// obligatorio, no cortés.
//
// ⚠️ Estas funciones son el EFECTO de un aviso del proveedor. La ruta HTTP que
// el proveedor llama para entregar ese aviso NO está construida: su contrato de
// firma no se puede verificar sin la cuenta, y escribirlo a ciegas sería
// inventar una verificación de seguridad. Es lo único que falta cuando el
// proveedor exista, y es una capa fina.

import { db } from "@/lib/db";
import { setSubscription } from "./subscription";

export type SuppressionResult = { applied: boolean; customerId: string | null };

/** Busca por correo, que es lo único que trae un aviso del proveedor. */
async function porCorreo(email: string) {
  return db.customer.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, emailUsable: true, acceptsMarketing: true },
  });
}

/**
 * Rebote duro: la dirección no existe o rechaza permanentemente.
 *
 * NO da de baja al cliente: su consentimiento sigue siendo válido, lo que
 * falla es la dirección. Si algún día corrige su correo, vuelve a ser
 * alcanzable sin tener que pedirle permiso otra vez.
 */
export async function recordHardBounce(email: string): Promise<SuppressionResult> {
  const c = await porCorreo(email);
  if (!c) return { applied: false, customerId: null };
  if (!c.emailUsable) return { applied: false, customerId: c.id }; // ya estaba

  await db.$transaction([
    db.customer.update({ where: { id: c.id }, data: { emailUsable: false } }),
    db.consentEvent.create({
      data: {
        customerId: c.id,
        subscribed: c.acceptsMarketing,
        source: "BOUNCE",
        note: "rebote duro: el correo dejó de ser utilizable",
      },
    }),
  ]);
  return { applied: true, customerId: c.id };
}

/** Queja de spam: baja inmediata, sin matices. */
export async function recordSpamComplaint(email: string): Promise<SuppressionResult> {
  const c = await porCorreo(email);
  if (!c) return { applied: false, customerId: null };

  const r = await setSubscription({
    customerId: c.id,
    subscribed: false,
    source: "SPAM_COMPLAINT",
    note: "el destinatario marcó el correo como spam",
  });
  return { applied: r.changed, customerId: c.id };
}

/** Un correo corregido vuelve a ser utilizable. Lo usa el módulo de clientes. */
export async function markEmailUsable(customerId: string): Promise<void> {
  await db.customer.update({ where: { id: customerId }, data: { emailUsable: true } });
}
