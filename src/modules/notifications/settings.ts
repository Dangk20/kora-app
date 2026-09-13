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

/**
 * TODAS las direcciones que deben enterarse de un pedido nuevo.
 *
 * Regla del negocio (28 ago 2026): el correo configurado del negocio **más
 * todos los usuarios con rol de administrador que estén activos**. Un
 * administrador nuevo empieza a recibir avisos sin que nadie toque nada, y uno
 * desactivado deja de recibirlos — que es lo que se espera de desactivarlo.
 *
 * Solo administradores: un cajero atiende pedidos pero no tiene por qué recibir
 * en su correo personal el aviso de cada venta del negocio.
 *
 * Se devuelven en minúsculas y SIN REPETIDOS. La deduplicación importa de
 * verdad: lo normal es que el correo configurado del negocio sea también el de
 * algún administrador, y sin esto esa persona recibiría el mismo aviso dos
 * veces — exactamente lo que el sistema de reservas existe para impedir.
 */
export type OrderNoticeRecipient = { email: string; name: string | null };

/**
 * Los destinatarios CON su nombre, para saludar a cada uno por el suyo.
 *
 * El correo fijo del negocio no es una cuenta y no tiene nombre: su aviso va
 * sin línea de saludo. Los administradores se saludan por el nombre de su
 * cuenta —nunca por el del comprador, que es lo que pasaba cuando el correo se
 * armaba una sola vez para todos (13 sep 2026)—. Si una misma dirección está
 * en las dos listas, gana la que trae nombre.
 */
export async function orderNoticeRecipientsDetailed(): Promise<OrderNoticeRecipient[]> {
  const [fijo, admins] = await Promise.all([
    staffEmail(),
    db.user.findMany({
      where: { active: true, role: { name: "admin" } },
      select: { email: true, name: true },
    }),
  ]);

  const porCorreo = new Map<string, OrderNoticeRecipient>();
  if (fijo) porCorreo.set(fijo, { email: fijo, name: null });
  for (const u of admins) {
    const email = u.email.trim().toLowerCase();
    if (!email) continue;
    const name = u.name?.trim() || null;
    const previo = porCorreo.get(email);
    porCorreo.set(email, { email, name: name ?? previo?.name ?? null });
  }
  return [...porCorreo.values()];
}

export async function orderNoticeRecipients(): Promise<string[]> {
  return (await orderNoticeRecipientsDetailed()).map((r) => r.email);
}
