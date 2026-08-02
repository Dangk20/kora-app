// La dirección de correo del negocio.
//
// Vive en `settings` y no en una variable de entorno por la misma razón que el
// número de WhatsApp: cambiarla es una decisión del negocio, no un despliegue.
// El día que cambie el operador no puede depender de nosotros.

import { db } from "@/lib/db";

export const STAFF_EMAIL_KEY = "email.staff";

/**
 * Dirección a la que llegan los avisos de pedido nuevo, o null.
 *
 * NO tiene valor por defecto a propósito. Un correo por defecto mandaría los
 * pedidos del cliente a un buzón nuestro sin que nadie lo hubiera decidido.
 * Sin configurar, el aviso se omite dejando constancia — que es lo que permite
 * darse cuenta de que el negocio está perdiendo avisos.
 */
export async function staffEmail(): Promise<string | null> {
  const setting = await db.setting.findUnique({ where: { key: STAFF_EMAIL_KEY } });
  const value = setting?.value;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export async function setStaffEmail(email: string): Promise<void> {
  const limpio = email.trim().toLowerCase();
  await db.setting.upsert({
    where: { key: STAFF_EMAIL_KEY },
    create: { key: STAFF_EMAIL_KEY, value: limpio },
    update: { value: limpio },
  });
}
