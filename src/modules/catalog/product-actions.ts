"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { receiveStock } from "@/modules/inventory/engine";
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
  /**
   * Los valores que componen esta variante, UNO POR GRUPO y en el orden de los
   * grupos. Vacío = variante suelta con nombre libre, que es todo el catálogo
   * anterior al 1 sep 2026 y sigue siendo válido.
   */
  optionValues: z.array(z.string().trim()).default([]),
});

const optionSchema = z.object({
  name: z.string().trim().min(1, "Cada grupo de opciones necesita nombre"),
  values: z
    .array(z.string().trim().min(1, "Cada opción necesita un valor"))
    .min(1, "Cada grupo necesita al menos un valor"),
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
  /**
   * Grupos de opciones: Talla → M, S. Máximo dos en esta versión — con tres,
   * la matriz pasa de cuatro filas a decenas y el panel necesita otra pantalla.
   */
  options: z.array(optionSchema).max(2, "Por ahora, máximo dos grupos de opciones").default([]),
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

      // ── Grupos de opciones ──────────────────────────────────────────────
      // Se reescriben enteros: el formulario manda la estructura completa, y
      // reconciliar diferencias parciales sobre dos niveles (grupos y valores)
      // añade estados imposibles de probar. Borrar un grupo arrastra sus
      // valores por cascada; las variantes que dependían de él ya no vienen en
      // el formulario y quedan desactivadas por el paso de abajo — no borradas,
      // porque pueden estar vendidas.
      await tx.productOption.deleteMany({
        where: {
          productId: product.id,
          name: { notIn: data.options.map((o) => o.name) },
        },
      });

      /** valor → id, para enlazar las variantes. Clave: "Talla|M". */
      const idPorValor = new Map<string, string>();

      for (const [i, grupo] of data.options.entries()) {
        const opcion = await tx.productOption.upsert({
          where: { productId_name: { productId: product.id, name: grupo.name } },
          create: { productId: product.id, name: grupo.name, position: i },
          update: { position: i },
          select: { id: true },
        });

        await tx.productOptionValue.deleteMany({
          where: { optionId: opcion.id, value: { notIn: grupo.values } },
        });

        for (const [j, valor] of grupo.values.entries()) {
          const fila = await tx.productOptionValue.upsert({
            where: { optionId_value: { optionId: opcion.id, value: valor } },
            create: { optionId: opcion.id, value: valor, position: j },
            update: { position: j },
            select: { id: true },
          });
          idPorValor.set(`${grupo.name}|${valor}`, fila.id);
        }
      }

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
            // ⚠️ Por `receiveStock()`, no escribiendo `stockActual` a mano.
            //
            // Hasta el 1 sep 2026 esto creaba el movimiento y materializaba
            // `stockActual` y `onlineUnits` por su cuenta — la regla 1 del
            // proyecto dice que esas dos columnas SOLO cambian dentro del
            // motor de inventario, y el importador ya lo hacía bien. Dos
            // caminos para mover inventario es exactamente lo que esa regla
            // existe para impedir: el día que el motor gane una comprobación,
            // este camino no la tendría y nadie se enteraría.
            //
            // `allOnline` deja todo el stock inicial publicado, como antes;
            // la asignación por canal se afina desde Inventario.
            await receiveStock(tx, {
              variantId: created.id,
              qty: v.initialStock,
              actorId: session.user.id,
              note: "Stock inicial al crear la variante",
              allOnline: true,
            });
          }
        }
      }

      // ── Enlace variante → valores ───────────────────────────────────────
      // También se reescribe entero, por variante: es un conjunto pequeño y
      // fijo (un valor por grupo), y calcular la diferencia costaría más que
      // rehacerlo.
      for (const [indice, v] of data.variants.entries()) {
        const variantId = keptIds[indice];
        await tx.variantOptionValue.deleteMany({ where: { variantId } });

        const valueIds = v.optionValues
          .map((valor, i) => idPorValor.get(`${data.options[i]?.name}|${valor}`))
          .filter((id): id is string => Boolean(id));

        if (valueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: valueIds.map((valueId) => ({ variantId, valueId })),
          });
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
