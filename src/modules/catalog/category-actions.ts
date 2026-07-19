"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { uniqueSlug } from "./slug";

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

const nameSchema = z.string().trim().min(2, "El nombre es muy corto");

const categoryExists = (slug: string) =>
  db.category.findUnique({ where: { slug } }).then(Boolean);

export async function createCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:create");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const last = await db.category.findFirst({ orderBy: { position: "desc" } });
  await db.category.create({
    data: {
      name: parsed.data,
      slug: await uniqueSlug(parsed.data, categoryExists),
      position: (last?.position ?? -1) + 1,
    },
  });
  revalidatePath("/admin/catalogo/categorias");
  return { ok: true };
}

export async function updateCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:edit");
  const parsed = z
    .object({
      id: z.string().min(1),
      name: nameSchema,
      active: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      active: formData.get("active") === "on",
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { id, name, active } = parsed.data;
  await db.category.update({ where: { id }, data: { name, active } });
  revalidatePath("/admin/catalogo/categorias");
  return { ok: true };
}

export async function deleteCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission("catalog:delete");
  const id = z.string().min(1).parse(formData.get("id"));

  const productCount = await db.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${productCount} producto(s). Reasígnalos primero.`,
    };
  }
  await db.category.delete({ where: { id } });
  revalidatePath("/admin/catalogo/categorias");
  return { ok: true };
}
