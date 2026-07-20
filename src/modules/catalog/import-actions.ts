"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth";
import { runImport, type ImportResult } from "./import/import";
import { parseCatalogWorkbook } from "./import/parse";

export type ImportActionResult = ImportResult | null;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function importCatalog(
  _prev: ImportActionResult,
  formData: FormData,
): Promise<ImportActionResult> {
  const session = await requirePermission("catalog:create");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: [{ row: 1, message: "Selecciona un archivo .xlsx" }] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, errors: [{ row: 1, message: "El archivo supera 8 MB. Quita imágenes u hojas extra, o divídelo." }] };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseCatalogWorkbook(buffer);
  if (!parsed.ok) {
    return { ok: false, errors: [{ row: 1, message: parsed.error }] };
  }

  const result = await runImport(parsed.rows, session.user.id, parsed.exampleRowsSkipped);
  if (result.ok) {
    revalidatePath("/admin/catalogo");
    revalidatePath("/admin/inventario");
  }
  return result;
}
