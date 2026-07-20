"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { uniqueSlug } from "./slug";

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

const money = z.coerce.number().min(0, "Precio inválido");

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "Cada variante necesita SKU"),
  name: z.string().trim().min(1, "Cada variante necesita nombre"),
  barcode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  priceCopStore: money,
  priceCopOnline: money,
  priceUsdStore: money,
  priceUsdOnline: money,
  stockMin: z.coerce.number().int().min(0).default(0),
  // Solo aplica a variantes nuevas: entra por el libro contable.
  initialStock: z.coerce.number().int().min(0, "Stock inicial inválido").default(0),
  active: z.boolean().default(true),
});

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre es muy corto"),
  brand: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  active: z.boolean(),
  featured: z.boolean(),
  variants: z.array(variantSchema).min(1, "El producto necesita al menos una variante"),
});

const productSlugExists = (slug: string) =>
  db.product.findUnique({ where: { slug } }).then(Boolean);

/**
 * Activa/desactiva el producto desde el switch del listado.
 * Un producto inactivo desaparece de la tienda pero conserva su historial:
 * nunca se borra nada que tenga ventas asociadas.
 */
export async function toggleProductActive(
  productId: string,
  active: boolean,
): Promise<{ ok: true; active: boolean } | { ok: false; error: string }> {
  await requirePermission("catalog:edit");
  if (typeof productId !== "string" || !productId) {
    return { ok: false, error: "Producto inválido" };
  }
  const updated = await db.product.update({
    where: { id: productId },
    data: { active },
    select: { active: true },
  });
  revalidatePath("/admin/catalogo");
  return { ok: true, active: updated.active };
}

export async function upsertProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requirePermission(
    formData.get("id") ? "catalog:edit" : "catalog:create",
  );

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Formulario inválido" };
  }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const skus = data.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    return { ok: false, error: "Hay SKUs repetidos entre las variantes" };
  }

  try {
    await db.$transaction(async (tx) => {
      const productBase = {
        name: data.name,
        brand: data.brand ?? null,
        categoryId: data.categoryId,
        description: data.description ?? null,
        active: data.active,
        featured: data.featured,
      };

      const product = data.id
        ? await tx.product.update({ where: { id: data.id }, data: productBase })
        : await tx.product.create({
            data: {
              ...productBase,
              slug: await uniqueSlug(data.name, productSlugExists),
            },
          });

      const keptIds: string[] = [];
      for (const v of data.variants) {
        const variantBase = {
          sku: v.sku,
          name: v.name,
          barcode: v.barcode ?? null,
          priceCopStore: v.priceCopStore,
          priceCopOnline: v.priceCopOnline,
          priceUsdStore: v.priceUsdStore,
          priceUsdOnline: v.priceUsdOnline,
          stockMin: v.stockMin,
          active: v.active,
        };
        if (v.id) {
          // Existente: nunca se toca stockActual desde aquí — eso es del
          // motor de inventario (ajuste_manual, S4).
          await tx.variant.update({ where: { id: v.id }, data: variantBase });
          keptIds.push(v.id);
        } else {
          const created = await tx.variant.create({
            data: { ...variantBase, productId: product.id },
          });
          keptIds.push(created.id);
          if (v.initialStock > 0) {
            await tx.stockMovement.create({
              data: {
                variantId: created.id,
                delta: v.initialStock,
                reason: "COMPRA_INICIAL",
                channel: "ADMIN",
                actorId: session.user.id,
                note: "Stock inicial al crear la variante",
              },
            });
            // Por defecto todo el stock inicial queda publicado online;
            // la asignación se afina desde Inventario.
            await tx.variant.update({
              where: { id: created.id },
              data: { stockActual: v.initialStock, onlineUnits: v.initialStock },
            });
          }
        }
      }

      // Variantes que el formulario ya no trae: se desactivan (nunca se borran —
      // pueden tener movimientos e historial de ventas).
      await tx.variant.updateMany({
        where: { productId: product.id, id: { notIn: keptIds } },
        data: { active: false },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un SKU o código de barras igual" };
    }
    throw e;
  }

  revalidatePath("/admin/catalogo");
  return { ok: true };
}
