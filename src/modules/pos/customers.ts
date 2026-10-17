// Clientes en la caja (change s09-pos-caja). El cajero busca por celular
// (WhatsApp), cédula, nombre o correo; si el cliente existe se precargan sus
// datos y la venta se le ata; si no, se crea con origen POS al cobrar.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizarTelefono } from "@/modules/customers/phone";

export type ClientePos = {
  id: string;
  name: string;
  /** Celular NACIONAL (sin +57), como lo escribe el cajero. */
  phone: string;
  document: string;
  email: string;
};

const nacional = (e164: string | null) => (e164 ?? "").replace(/^\+57/, "");

/**
 * El cliente de ese celular (WhatsApp), o `null` si es nuevo. Búsqueda EXACTA
 * por el número normalizado: el cajero escribe el celular, pulsa "Buscar" y
 * se precargan los datos. Un parecido no sirve aquí — precargar a otra
 * persona es peor que pedir los datos de nuevo.
 */
export async function buscarClientePorCelular(celular: string): Promise<ClientePos | null> {
  const phone = normalizarTelefono(celular);
  if (!phone) return null;
  const c = await db.customer.findUnique({
    where: { phone },
    select: { id: true, name: true, phone: true, document: true, email: true },
  });
  return c ? { id: c.id, name: c.name, phone: nacional(c.phone), document: c.document ?? "", email: c.email ?? "" } : null;
}

export type DatosClienteVenta = {
  id?: string;
  name: string;
  phone: string;
  document?: string;
  email?: string;
};

/**
 * El cliente de una venta de caja, DENTRO de la transacción de la venta.
 *
 * Con `id` (lo eligió del buscador) se ata a ese cliente; si no, se busca por
 * celular, luego por correo y luego por cédula, y si no aparece se crea con
 * origen POS. Lo que el cliente da en caja COMPLETA su ficha —p. ej. la
 * cédula que no pidió el registro web— pero no pisa lo que ya tenía: el
 * celular y el correo son únicos y cambiarlos aquí podría robarle la
 * identidad a otra ficha.
 */
export async function resolverClienteVenta(
  tx: Prisma.TransactionClient,
  datos: DatosClienteVenta,
): Promise<{ id: string; phone: string | null; email: string | null; document: string | null; name: string }> {
  const phone = normalizarTelefono(datos.phone);
  const email = datos.email?.trim().toLowerCase() || null;
  const document = datos.document?.replace(/\s/g, "") || null;
  const name = datos.name.trim();

  let existente =
    (datos.id ? await tx.customer.findUnique({ where: { id: datos.id } }) : null) ??
    (phone ? await tx.customer.findUnique({ where: { phone } }) : null) ??
    (email ? await tx.customer.findUnique({ where: { email } }) : null) ??
    (document ? await tx.customer.findFirst({ where: { document } }) : null);

  if (!existente) {
    // El correo puede ser de otra ficha que no se encontró por celular: en
    // ese caso no se usa, en vez de chocar con el índice único.
    const correoLibre = email && !(await tx.customer.findUnique({ where: { email }, select: { id: true } })) ? email : null;
    existente = await tx.customer.create({
      data: { name, phone, email: correoLibre, document, source: "POS", country: "CO" },
    });
  } else {
    const completar: Prisma.CustomerUpdateInput = {};
    if (!existente.document && document) completar.document = document;
    if (!existente.phone && phone && !(await tx.customer.findUnique({ where: { phone }, select: { id: true } }))) {
      completar.phone = phone;
    }
    if (!existente.email && email && !(await tx.customer.findUnique({ where: { email }, select: { id: true } }))) {
      completar.email = email;
    }
    if (Object.keys(completar).length > 0) {
      existente = await tx.customer.update({ where: { id: existente.id }, data: completar });
    }
  }
  return { id: existente.id, name: existente.name || name, phone: existente.phone, email: existente.email, document: existente.document };
}
