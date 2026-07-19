"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { uniqueSlug } from "./slug";

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

const nameSchema = z.string().trim().min(2, "El nombre es muy corto");
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
  .optional();

const categoryExists = (slug: string) =>
  db.category.findUnique({ where: { slug } }).then(Boolean);

const CATEGORIES_PATH = "/admin/catalogo/categorias";

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:create");
  const parsed = z
    .object({
      name: nameSchema,
      color: colorSchema,
      icon: z.string().trim().optional(),
      parentId: z
        .string()
        .optional()
        .transform((v) => (v ? v : undefined)),
    })
    .safeParse({
      name: formData.get("name"),
      color: formData.get("color") || undefined,
      icon: formData.get("icon") || undefined,
      parentId: formData.get("parentId") || undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, color, icon, parentId } = parsed.data;

  let inherited: { color: string; icon: string } | undefined;
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } });
    if (!parent) return { ok: false, error: "La categoría padre no existe" };
    if (parent.parentId) {
      return { ok: false, error: "Solo hay un nivel de subcategorías" };
    }
    inherited = { color: parent.color, icon: parent.icon };
  }

  const last = await db.category.findFirst({
    where: { parentId: parentId ?? null },
    orderBy: { position: "desc" },
  });
  await db.category.create({
    data: {
      name,
      slug: await uniqueSlug(name, categoryExists),
      position: (last?.position ?? -1) + 1,
      parentId,
      color: color ?? inherited?.color ?? "#FBE3D3",
      icon: icon ?? inherited?.icon ?? "package",
    },
  });
  revalidatePath(CATEGORIES_PATH);
  return { ok: true };
}

/**
 * Creación rápida desde el formulario de producto (sin salir del slide-over).
 * Hereda color/ícono del padre; las categorías raíz salen con el default y
 * se personalizan después en Categorías.
 */
export async function quickCreateCategory(input: {
  name: string;
  parentId?: string;
}): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  await requirePermission("catalog:create");
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let inherited: { color: string; icon: string } | undefined;
  if (input.parentId) {
    const parent = await db.category.findUnique({ where: { id: input.parentId } });
    if (!parent) return { ok: false, error: "La categoría padre no existe" };
    if (parent.parentId) return { ok: false, error: "Solo hay un nivel de subcategorías" };
    inherited = { color: parent.color, icon: parent.icon };
  }

  const last = await db.category.findFirst({
    where: { parentId: input.parentId ?? null },
    orderBy: { position: "desc" },
  });
  const created = await db.category.create({
    data: {
      name: parsed.data,
      slug: await uniqueSlug(parsed.data, categoryExists),
      position: (last?.position ?? -1) + 1,
      parentId: input.parentId,
      color: inherited?.color ?? "#FBE3D3",
      icon: inherited?.icon ?? "package",
    },
  });
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/admin/catalogo");
  return { ok: true, id: created.id, name: created.name };
}

export async function updateCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:edit");
  const parsed = z
    .object({
      id: z.string().min(1),
      name: nameSchema.optional(),
      color: colorSchema,
      icon: z.string().trim().optional(),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name") || undefined,
      color: formData.get("color") || undefined,
      icon: formData.get("icon") || undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;

  await db.category.update({ where: { id }, data });
  revalidatePath(CATEGORIES_PATH);
  return { ok: true };
}

export async function deleteCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:delete");
  const id = z.string().min(1).parse(formData.get("id"));

  const [productCount, childCount] = await Promise.all([
    db.product.count({ where: { categoryId: id } }),
    db.category.count({ where: { parentId: id } }),
  ]);
  if (productCount > 0) {
    return {
      ok: false,
      error: `Tiene ${productCount} producto(s). Reasígnalos primero.`,
    };
  }
  if (childCount > 0) {
    return {
      ok: false,
      error: `Tiene ${childCount} subcategoría(s). Elimínalas primero.`,
    };
  }
  await db.category.delete({ where: { id } });
  revalidatePath(CATEGORIES_PATH);
  return { ok: true };
}
