"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  imageKey,
  sniffImageType,
  storage,
} from "@/modules/storage";

export type ImageActionResult =
  | { ok: true; images: { id: string; url: string; alt: string | null }[] }
  | { ok: false; error: string }
  | null;

async function imagesOf(productId: string) {
  const images = await db.productImage.findMany({
    where: { productId },
    orderBy: { position: "asc" },
  });
  const driver = storage();
  return images.map((i) => ({
    id: i.id,
    url: driver.urlFor(i.url),
    alt: i.alt,
  }));
}

export async function uploadProductImages(
  _prev: ImageActionResult,
  formData: FormData,
): Promise<ImageActionResult> {
  await requirePermission("catalog:edit");

  const productId = String(formData.get("productId") ?? "");
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) return { ok: false, error: "El producto no existe" };

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Selecciona al menos una imagen" };

  const current = await db.productImage.count({ where: { productId } });
  if (current + files.length > MAX_IMAGES_PER_PRODUCT) {
    return {
      ok: false,
      error: `Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto (ya tiene ${current})`,
    };
  }

  const driver = storage();
  const uploaded: string[] = [];
  try {
    let position = current;
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`"${file.name}" pesa más de 5 MB`);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      // El tipo real manda sobre el que declara el navegador.
      const realType = sniffImageType(buffer);
      if (!realType || !ALLOWED_IMAGE_TYPES[realType]) {
        throw new Error(`"${file.name}" no es una imagen JPG, PNG, WebP o AVIF`);
      }

      const key = imageKey(productId, realType);
      await driver.put(key, buffer, realType);
      uploaded.push(key);
      await db.productImage.create({
        data: { productId, url: key, alt: product.name, position: position++ },
      });
    }
  } catch (e) {
    // Lo subido en este intento se borra: no dejamos huérfanos en el bucket.
    await Promise.all(uploaded.map((key) => driver.delete(key).catch(() => {})));
    await db.productImage.deleteMany({ where: { url: { in: uploaded } } });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo subir la imagen",
    };
  }

  revalidatePath("/admin/catalogo");
  return { ok: true, images: await imagesOf(productId) };
}

export async function deleteProductImage(
  _prev: ImageActionResult,
  formData: FormData,
): Promise<ImageActionResult> {
  await requirePermission("catalog:edit");
  const id = String(formData.get("imageId") ?? "");
  const image = await db.productImage.findUnique({ where: { id } });
  if (!image) return { ok: false, error: "La imagen ya no existe" };

  await db.productImage.delete({ where: { id } });
  await storage().delete(image.url);

  // Cerrar el hueco de posiciones para que el orden siga siendo 0..n-1.
  const rest = await db.productImage.findMany({
    where: { productId: image.productId },
    orderBy: { position: "asc" },
  });
  await db.$transaction(
    rest.map((img, i) =>
      db.productImage.update({ where: { id: img.id }, data: { position: i } }),
    ),
  );

  revalidatePath("/admin/catalogo");
  return { ok: true, images: await imagesOf(image.productId) };
}

/** Mueve una imagen a la primera posición (la que se ve en la tienda). */
export async function makePrimaryImage(
  _prev: ImageActionResult,
  formData: FormData,
): Promise<ImageActionResult> {
  await requirePermission("catalog:edit");
  const id = String(formData.get("imageId") ?? "");
  const image = await db.productImage.findUnique({ where: { id } });
  if (!image) return { ok: false, error: "La imagen ya no existe" };

  const others = await db.productImage.findMany({
    where: { productId: image.productId, id: { not: id } },
    orderBy: { position: "asc" },
  });
  await db.$transaction([
    db.productImage.update({ where: { id }, data: { position: 0 } }),
    ...others.map((img, i) =>
      db.productImage.update({ where: { id: img.id }, data: { position: i + 1 } }),
    ),
  ]);

  revalidatePath("/admin/catalogo");
  return { ok: true, images: await imagesOf(image.productId) };
}
