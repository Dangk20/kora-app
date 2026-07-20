// Importación del catálogo: valida TODO el archivo primero y escribe en una
// sola transacción — o entra completo, o no entra nada. El cliente corrige
// su Excel con la lista de errores y lo vuelve a subir.
//
// Semántica por SKU:
//   - SKU nuevo  → crea variante (y producto/categoría si no existen);
//                  el stock inicial entra por el motor de inventario (ledger).
//   - SKU existente → actualiza precios/nombre/código de barras. El stock NO
//                  se toca: re-importar jamás duplica inventario. Los ajustes
//                  de stock viven en Inventario (motor, con kardex).
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { receiveStock } from "@/modules/inventory/engine";
import { importRowSchema, normalize, type ImportRow } from "./columns";
import { uniqueSlug } from "../slug";
import type { RawRow } from "./parse";

export type RowError = { row: number; message: string };

export type ImportSummary = {
  productsCreated: number;
  variantsCreated: number;
  variantsUpdated: number;
  categoriesCreated: number;
  unitsReceived: number;
  exampleRowsSkipped: number;
};

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; errors: RowError[] };

export const MAX_IMPORT_ROWS = 2000;

type ValidRow = { row: number; data: ImportRow };

/** Fase 1: validación completa (formato, duplicados, coherencia entre filas). */
export function validateRows(rawRows: RawRow[]):
  | { ok: true; rows: ValidRow[] }
  | { ok: false; errors: RowError[] } {
  const errors: RowError[] = [];
  const rows: ValidRow[] = [];

  if (rawRows.length === 0) {
    return { ok: false, errors: [{ row: 2, message: "El archivo no tiene filas de datos" }] };
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      errors: [
        { row: 1, message: `El archivo tiene ${rawRows.length} filas; el máximo por importación es ${MAX_IMPORT_ROWS}. Divídelo en varios archivos.` },
      ],
    };
  }

  for (const raw of rawRows) {
    const parsed = importRowSchema.safeParse(raw.values);
    if (!parsed.success) {
      errors.push({ row: raw.row, message: parsed.error.issues[0].message });
    } else {
      rows.push({ row: raw.row, data: parsed.data });
    }
  }

  // Duplicados dentro del archivo (SKU y código de barras).
  const bySku = new Map<string, number>();
  const byBarcode = new Map<string, number>();
  for (const { row, data } of rows) {
    const sku = normalize(data.sku);
    if (bySku.has(sku)) {
      errors.push({ row, message: `SKU "${data.sku}" repetido (ya aparece en la fila ${bySku.get(sku)})` });
    } else {
      bySku.set(sku, row);
    }
    if (data.barcode) {
      if (byBarcode.has(data.barcode)) {
        errors.push({ row, message: `Código de barras "${data.barcode}" repetido (fila ${byBarcode.get(data.barcode)})` });
      } else {
        byBarcode.set(data.barcode, row);
      }
    }
  }

  // Filas del mismo producto deben coincidir en categoría.
  const productCategory = new Map<string, { row: number; cat: string }>();
  for (const { row, data } of rows) {
    const key = normalize(data.producto);
    const cat = `${normalize(data.categoria)}|${normalize(data.subcategoria ?? "")}`;
    const seen = productCategory.get(key);
    if (!seen) {
      productCategory.set(key, { row, cat });
    } else if (seen.cat !== cat) {
      errors.push({
        row,
        message: `"${data.producto}" tiene otra categoría en la fila ${seen.row}: las variantes de un producto deben compartir categoría`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.sort((a, b) => a.row - b.row) };
  }
  return { ok: true, rows };
}

/** Fase 2: escritura transaccional. Asume filas ya validadas. */
export async function importCatalogRows(
  validRows: ValidRow[],
  actorId: string,
  exampleRowsSkipped = 0,
): Promise<ImportResult> {
  const summary: ImportSummary = {
    productsCreated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    categoriesCreated: 0,
    unitsReceived: 0,
    exampleRowsSkipped,
  };

  try {
    await db.$transaction(
      async (tx) => {
        // Categorías: resolver/crear una sola vez por nombre.
        const categoryCache = new Map<string, string>(); // "cat|sub" normalizado → id
        const resolveCategory = async (name: string, parentId: string | null) => {
          const key = `${parentId ?? ""}|${normalize(name)}`;
          const cached = categoryCache.get(key);
          if (cached) return cached;
          const existing = await tx.category.findFirst({
            where: { name: { equals: name, mode: "insensitive" }, parentId },
          });
          if (existing) {
            categoryCache.set(key, existing.id);
            return existing.id;
          }
          const last = await tx.category.findFirst({
            where: { parentId },
            orderBy: { position: "desc" },
          });
          const parent = parentId
            ? await tx.category.findUniqueOrThrow({ where: { id: parentId } })
            : null;
          const created = await tx.category.create({
            data: {
              name,
              slug: await uniqueSlug(name, (s) =>
                tx.category.findUnique({ where: { slug: s } }).then(Boolean),
              ),
              position: (last?.position ?? -1) + 1,
              parentId,
              color: parent?.color ?? "#FBE3D3",
              icon: parent?.icon ?? "package",
            },
          });
          summary.categoriesCreated++;
          categoryCache.set(key, created.id);
          return created.id;
        };

        // Variantes existentes por SKU (para actualizar en vez de crear).
        const existing = await tx.variant.findMany({
          where: { sku: { in: validRows.map((r) => r.data.sku) } },
          select: { id: true, sku: true },
        });
        const existingBySku = new Map(existing.map((v) => [normalize(v.sku), v.id]));

        const productCache = new Map<string, string>(); // nombre normalizado → id

        for (const { data } of validRows) {
          const prices = {
            priceCopStore: data.priceCopStore,
            priceCopOnline: data.priceCopOnline,
            priceUsdStore: data.priceUsdStore,
            priceUsdOnline: data.priceUsdOnline,
          };
          const variantId = existingBySku.get(normalize(data.sku));

          if (variantId) {
            // SKU existente: precios y datos sí; stock jamás (ver cabecera).
            await tx.variant.update({
              where: { id: variantId },
              data: {
                ...prices,
                ...(data.variante ? { name: data.variante } : {}),
                ...(data.barcode ? { barcode: data.barcode } : {}),
              },
            });
            summary.variantsUpdated++;
            continue;
          }

          // Producto: reusar por nombre o crear con su categoría.
          const productKey = normalize(data.producto);
          let productId = productCache.get(productKey);
          if (!productId) {
            const found = await tx.product.findFirst({
              where: { name: { equals: data.producto, mode: "insensitive" } },
              select: { id: true },
            });
            if (found) {
              productId = found.id;
            } else {
              const rootId = await resolveCategory(data.categoria, null);
              const categoryId = data.subcategoria
                ? await resolveCategory(data.subcategoria, rootId)
                : rootId;
              const created = await tx.product.create({
                data: {
                  name: data.producto,
                  slug: await uniqueSlug(data.producto, (s) =>
                    tx.product.findUnique({ where: { slug: s } }).then(Boolean),
                  ),
                  categoryId,
                  brand: data.marca ?? null,
                  description: data.descripcion ?? null,
                },
              });
              summary.productsCreated++;
              productId = created.id;
            }
            productCache.set(productKey, productId);
          }

          const variant = await tx.variant.create({
            data: {
              productId,
              sku: data.sku,
              name: data.variante ?? "Única",
              barcode: data.barcode ?? null,
              ...prices,
            },
          });
          summary.variantsCreated++;

          if (data.stockInicial > 0) {
            await receiveStock(tx, {
              variantId: variant.id,
              qty: data.stockInicial,
              actorId,
              note: "Importación de catálogo (Excel)",
            });
            summary.unitsReceived += data.stockInicial;
          }
        }
      },
      { timeout: 180_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        errors: [{ row: 1, message: "Un SKU o código de barras del archivo ya existe con otro valor en el sistema. No se importó nada." }],
      };
    }
    throw e;
  }

  return { ok: true, summary };
}

/** Pipeline completo sobre filas ya parseadas del workbook. */
export async function runImport(
  rawRows: RawRow[],
  actorId: string,
  exampleRowsSkipped = 0,
): Promise<ImportResult> {
  const validated = validateRows(rawRows);
  if (!validated.ok) return validated;
  return importCatalogRows(validated.rows, actorId, exampleRowsSkipped);
}
