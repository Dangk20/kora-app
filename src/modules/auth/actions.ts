"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

const createSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  roleId: z.string().min(1, "Selecciona un rol"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "El nombre es muy corto"),
  roleId: z.string().min(1, "Selecciona un rol"),
  active: z.coerce.boolean(),
  // Vacía = no cambiar la contraseña
  password: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional()),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function createUser(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("users:create");
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { name, email, roleId, password } = parsed.data;
  try {
    await db.user.create({
      data: { name, email, roleId, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un usuario con ese correo" };
    }
    throw e;
  }
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function updateUser(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission("users:edit");
  const parsed = updateSchema.safeParse({
    ...Object.fromEntries(formData),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, name, roleId, active, password } = parsed.data;

  if (id === session.user.id && !active) {
    return { ok: false, error: "No puedes desactivar tu propio usuario" };
  }

  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) return { ok: false, error: "El usuario no existe" };

  // Nunca dejar el sistema sin un admin activo
  if (target.role.name === "admin" && target.active) {
    const losesAdmin =
      !active || (await db.role.findUnique({ where: { id: roleId } }))?.name !== "admin";
    if (losesAdmin) {
      const otherAdmins = await db.user.count({
        where: { role: { name: "admin" }, active: true, id: { not: id } },
      });
      if (otherAdmins === 0) {
        return { ok: false, error: "No puedes quitar el último admin activo" };
      }
    }
  }

  await db.user.update({
    where: { id },
    data: {
      name,
      roleId,
      active,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
