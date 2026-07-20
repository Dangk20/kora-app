"use server";

// Acciones del módulo Vitrina. Todo bajo permiso de catálogo: quien arma la
// vitrina es quien administra los productos.
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageKey,
  sniffImageType,
  storage,
} from "@/modules/storage";
import { MAX_SECTION_ITEMS } from "./sections";

export type ShowcaseResult = { ok: true } | { ok: false; error: string };

/** La vitrina cambia la portada de la tienda: hay que revalidar ambas. */
function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/admin/vitrina");
}

export async function updateSection(
  key: string,
  data: {
    title?: string;
    active?: boolean;
    mode?: "MANUAL" | "AUTO";
    autoRule?: "BEST_SELLERS" | "NEWEST" | "ONLINE_DEAL" | "FEATURED";
  },
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");
  const title = data.title?.trim();
  if (title !== undefined && title.length < 2) {
    return { ok: false, error: "El título es muy corto" };
  }

  await db.showcaseSection.update({
    where: { key },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.mode ? { mode: data.mode } : {}),
      ...(data.autoRule ? { autoRule: data.autoRule } : {}),
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function addProductToSection(
  key: string,
  productId: string,
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");

  const section = await db.showcaseSection.findUnique({
    where: { key },
    include: { _count: { select: { items: true } } },
  });
  if (!section) return { ok: false, error: "La sección no existe" };
  // El límite no es el diseño (los que sobran rotan en carrusel), solo un tope
  // razonable para que la portada no cargue medio catálogo.
  if (section._count.items >= MAX_SECTION_ITEMS) {
    return {
      ok: false,
      error: `Máximo ${MAX_SECTION_ITEMS} productos por sección.`,
    };
  }

  const last = await db.showcaseItem.findFirst({
    where: { sectionKey: key },
    orderBy: { position: "desc" },
  });

  try {
    await db.showcaseItem.create({
      data: {
        sectionKey: key,
        productId,
        position: (last?.position ?? -1) + 1,
      },
    });
  } catch {
    return { ok: false, error: "Ese producto ya está en la sección" };
  }
  revalidateAll();
  return { ok: true };
}

export async function removeProductFromSection(
  key: string,
  productId: string,
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");
  await db.showcaseItem.deleteMany({ where: { sectionKey: key, productId } });

  // Cerrar el hueco para que el orden siga siendo 0..n-1.
  const rest = await db.showcaseItem.findMany({
    where: { sectionKey: key },
    orderBy: { position: "asc" },
  });
  await db.$transaction(
    rest.map((item, i) =>
      db.showcaseItem.update({ where: { id: item.id }, data: { position: i } }),
    ),
  );

  revalidateAll();
  return { ok: true };
}

/** Mueve un producto una posición arriba o abajo dentro de su sección. */
export async function moveProductInSection(
  key: string,
  productId: string,
  direction: "up" | "down",
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");

  const items = await db.showcaseItem.findMany({
    where: { sectionKey: key },
    orderBy: { position: "asc" },
  });
  const index = items.findIndex((i) => i.productId === productId);
  if (index === -1) return { ok: false, error: "El producto no está en la sección" };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return { ok: true }; // ya está en el borde

  await db.$transaction([
    db.showcaseItem.update({
      where: { id: items[index].id },
      data: { position: target },
    }),
    db.showcaseItem.update({
      where: { id: items[target].id },
      data: { position: index },
    }),
  ]);

  revalidateAll();
  return { ok: true };
}

/**
 * Crea o actualiza una PIEZA de un espacio publicitario. Un espacio admite
 * varias: la tienda las rota sola. Si viene `bannerId` se edita esa pieza;
 * si no, se agrega una nueva al final.
 */
export async function saveBanner(
  _prev: ShowcaseResult | null,
  formData: FormData,
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");

  const slot = String(formData.get("slot") ?? "");
  if (!slot) return { ok: false, error: "Espacio inválido" };

  const bannerId = String(formData.get("bannerId") ?? "") || null;
  const productId = String(formData.get("productId") ?? "") || null;
  const active = formData.get("active") === "on";
  const title = String(formData.get("title") ?? "").trim() || "Pieza publicitaria";

  const existing = bannerId
    ? await db.banner.findUnique({ where: { id: bannerId } })
    : null;

  const file = formData.get("image");
  let key = existing?.imageUrl ?? null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "La imagen supera 5 MB" };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const realType = sniffImageType(buffer);
    if (!realType || !ALLOWED_IMAGE_TYPES[realType]) {
      return { ok: false, error: "El archivo no es una imagen JPG, PNG, WebP o AVIF" };
    }
    const driver = storage();
    const newKey = imageKey(`banners/${slot}`, realType);
    await driver.put(newKey, buffer, realType);
    // La anterior se borra solo si la subida nueva salió bien.
    if (existing?.imageUrl) await driver.delete(existing.imageUrl).catch(() => {});
    key = newKey;
  }

  if (!key) return { ok: false, error: "Sube una imagen para esta pieza" };

  if (existing) {
    await db.banner.update({
      where: { id: existing.id },
      data: { title, imageUrl: key, productId, active },
    });
  } else {
    const last = await db.banner.findFirst({
      where: { slot },
      orderBy: { position: "desc" },
    });
    await db.banner.create({
      data: {
        slot,
        title,
        imageUrl: key,
        productId,
        active,
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  revalidateAll();
  return { ok: true };
}

/** Elimina una pieza y cierra el hueco de posiciones del espacio. */
export async function deleteBanner(bannerId: string): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");
  const existing = await db.banner.findUnique({ where: { id: bannerId } });
  if (!existing) return { ok: true };

  if (existing.imageUrl) await storage().delete(existing.imageUrl).catch(() => {});
  await db.banner.delete({ where: { id: bannerId } });

  const rest = await db.banner.findMany({
    where: { slot: existing.slot },
    orderBy: { position: "asc" },
  });
  await db.$transaction(
    rest.map((b, i) => db.banner.update({ where: { id: b.id }, data: { position: i } })),
  );

  revalidateAll();
  return { ok: true };
}

/** Cambia el orden en que rotan las piezas de un espacio. */
export async function moveBanner(
  bannerId: string,
  direction: "up" | "down",
): Promise<ShowcaseResult> {
  await requirePermission("catalog:edit");
  const banner = await db.banner.findUnique({ where: { id: bannerId } });
  if (!banner) return { ok: false, error: "La pieza no existe" };

  const list = await db.banner.findMany({
    where: { slot: banner.slot },
    orderBy: { position: "asc" },
  });
  const index = list.findIndex((b) => b.id === bannerId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= list.length) return { ok: true };

  await db.$transaction([
    db.banner.update({ where: { id: list[index].id }, data: { position: target } }),
    db.banner.update({ where: { id: list[target].id }, data: { position: index } }),
  ]);

  revalidateAll();
  return { ok: true };
}

/** Buscador de productos del modal de la vitrina. */
export async function searchProductsForShowcase(
  term: string,
): Promise<{ id: string; name: string; sku: string; imageUrl: string | null }[]> {
  await requirePermission("catalog:view");
  const q = term.trim();

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
              { variants: { some: { sku: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const driver = storage();
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.variants[0]?.sku ?? "—",
    imageUrl: p.images[0] ? driver.urlFor(p.images[0].url) : null,
  }));
}
