"use server";

// Alta y edición de clientes.
// Ver openspec/changes/modulo-clientes — specs/customer-management.
//
// NO existe eliminación, y no es un olvido: el histórico es permanente porque
// alimenta el remarketing y la fidelización. Borrar un cliente se lleva por
// delante las compras que explican su saldo — y un saldo sin las compras que lo
// justifican es un pasivo que nadie puede auditar.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { isUsablePhone, toE164 } from "./phone";
import { setPrincipalDesdePanel } from "./addresses";

export type CustomerActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: string };

const baseSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre completo"),
  country: z.enum(["CO", "US"]),
  phone: z.string().trim().min(7, "Escribe el número de WhatsApp"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  document: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  address: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({ id: z.string().min(1) });

function firstError(e: z.ZodError): { error: string; field?: string } {
  const issue = e.issues[0];
  return { error: issue.message, field: String(issue.path[0] ?? "") };
}

/**
 * Comprueba que el teléfono y el correo no pertenezcan ya a OTRO cliente.
 *
 * La comprobación va sobre el teléfono YA NORMALIZADO. Hacerlo sobre lo que la
 * persona escribió dejaría entrar el mismo número en otro formato, y la
 * restricción de unicidad de la base tampoco lo vería: para ella son cadenas
 * distintas. Como los clientes no se eliminan, ese duplicado sería permanente.
 */
async function buscarConflicto(
  e164: string,
  email: string | undefined,
  excluirId?: string,
): Promise<{ error: string; field: string } | null> {
  const porTelefono = await db.customer.findFirst({
    where: { phone: e164, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true, name: true },
  });
  if (porTelefono) {
    return {
      error: `Ese número de WhatsApp ya pertenece a ${porTelefono.name}.`,
      field: "phone",
    };
  }

  if (email) {
    const porCorreo = await db.customer.findFirst({
      where: { email, ...(excluirId ? { id: { not: excluirId } } : {}) },
      select: { id: true, name: true },
    });
    if (porCorreo) {
      return { error: `Ese correo ya pertenece a ${porCorreo.name}.`, field: "email" };
    }
  }
  return null;
}

export async function createCustomer(formData: FormData): Promise<CustomerActionResult> {
  await requirePermission("customers:create");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, ...firstError(parsed.error) };
  const d = parsed.data;

  const e164 = toE164(d.phone, d.country);
  if (!isUsablePhone(e164)) {
    return { ok: false, error: "Ese número de WhatsApp no parece válido.", field: "phone" };
  }

  const conflicto = await buscarConflicto(e164, d.email);
  if (conflicto) return { ok: false, ...conflicto };

  const cliente = await db.customer.create({
    data: {
      name: d.name,
      phone: e164,
      email: d.email ?? null,
      document: d.document ?? null,
      country: d.country,
      source: "MANUAL",
    },
    select: { id: true },
  });

  // La dirección entra por la libreta, no como columnas sueltas: desde el
  // 1 sep 2026 `customer.city`/`address` son un ESPEJO de la predeterminada y
  // solo los escribe `sincronizarDireccionPrincipal`. Escribirlos aquí los
  // separaría del dato real en cuanto el comprador tocara su libreta.
  await setPrincipalDesdePanel(cliente.id, {
    city: d.city,
    address: d.address,
    country: d.country,
  });

  revalidatePath("/admin/clientes");
  return { ok: true, id: cliente.id };
}

/**
 * Editar incluye cambiar el teléfono, que ES el identificador del cliente.
 *
 * Si el nuevo teléfono ya pertenece a otro, se RECHAZA — no se fusionan los dos
 * clientes. Fusionar implicaría decidir qué pasa con dos historiales de compra
 * y dos saldos: es una operación con consecuencias sobre dinero y merece su
 * propia decisión de producto. Rechazar deja el problema visible; fusionar en
 * silencio lo esconde.
 */
export async function updateCustomer(formData: FormData): Promise<CustomerActionResult> {
  await requirePermission("customers:edit");

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, ...firstError(parsed.error) };
  const d = parsed.data;

  const existe = await db.customer.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!existe) return { ok: false, error: "Ese cliente ya no existe." };

  const e164 = toE164(d.phone, d.country);
  if (!isUsablePhone(e164)) {
    return { ok: false, error: "Ese número de WhatsApp no parece válido.", field: "phone" };
  }

  // Se excluye al propio cliente: guardar sin tocar el teléfono no puede
  // señalarlo como duplicado de sí mismo.
  const conflicto = await buscarConflicto(e164, d.email, d.id);
  if (conflicto) return { ok: false, ...conflicto };

  await db.customer.update({
    where: { id: d.id },
    data: {
      name: d.name,
      phone: e164,
      email: d.email ?? null,
      document: d.document ?? null,
      country: d.country,
    },
  });

  // Igual que al crear: la dirección del panel actualiza la predeterminada.
  await setPrincipalDesdePanel(d.id, {
    city: d.city,
    address: d.address,
    country: d.country,
  });

  revalidatePath("/admin/clientes");
  return { ok: true, id: d.id };
}
