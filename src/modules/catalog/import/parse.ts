// Lectura del .xlsx: encuentra la hoja de catálogo, mapea encabezados a
// columnas conocidas y devuelve filas crudas con su número de fila real
// (para que los errores digan "fila 7", no "índice 4").
import ExcelJS from "exceljs";
import { IMPORT_COLUMNS, normalize, type ColumnKey } from "./columns";

export type RawRow = {
  /** Número de fila en el Excel (1-based, como lo ve el cliente). */
  row: number;
  values: Partial<Record<ColumnKey, unknown>>;
};

export type ParseResult =
  | { ok: true; rows: RawRow[]; exampleRowsSkipped: number }
  | { ok: false; error: string };

/** Celdas de exceljs pueden ser richText, fórmulas, hipervínculos… → valor plano. */
function plainValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return plainValue(v.result as ExcelJS.CellValue);
    if ("text" in v) return v.text;
    if ("error" in v) return undefined;
    return undefined;
  }
  return v;
}

/**
 * Números como los escribe la gente: "$ 85.000", "24,99", "1.250.000".
 * Si no se puede interpretar, devuelve el valor original y la validación
 * lo reporta como "debe ser un número".
 */
function coerceNumber(v: unknown): unknown {
  if (typeof v === "number" || typeof v !== "string") return v;
  let s = v.replace(/[$\s]/g, "").replace(/(cop|usd|us)/gi, "");
  if (!s) return undefined;
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", "."); // 1.250.000,50
  } else if (s.includes(",")) {
    s = s.replace(",", "."); // 24,99
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // 85.000 → puntos de miles
  }
  const n = Number(s);
  return Number.isNaN(n) ? v : n;
}

const NUMERIC_KEYS: ColumnKey[] = [
  "priceCopStore",
  "priceCopOnline",
  "priceUsdStore",
  "priceUsdOnline",
  "stockInicial",
];

export async function parseCatalogWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: "El archivo no es un Excel válido (.xlsx)" };
  }

  // La hoja de datos: "Catálogo" si existe; si no, la primera que no sea instrucciones.
  const sheet =
    workbook.worksheets.find((w) => normalize(w.name).includes("catalogo")) ??
    workbook.worksheets.find((w) => !normalize(w.name).includes("instrucciones"));
  if (!sheet) return { ok: false, error: "El archivo no tiene hojas de datos" };

  // Mapa columna del Excel → columna conocida, por encabezado normalizado.
  const headerRow = sheet.getRow(1);
  const colMap = new Map<number, ColumnKey>();
  headerRow.eachCell((cell, colNumber) => {
    const text = plainValue(cell.value);
    if (typeof text !== "string") return;
    const match = IMPORT_COLUMNS.find((c) => normalize(c.header) === normalize(text));
    if (match) colMap.set(colNumber, match.key);
  });

  const missing = IMPORT_COLUMNS.filter(
    (c) => c.required && ![...colMap.values()].includes(c.key),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Faltan columnas en la plantilla: ${missing.map((c) => `"${c.header}"`).join(", ")}. Descarga la plantilla y no cambies los encabezados.`,
    };
  }

  const rows: RawRow[] = [];
  let exampleRowsSkipped = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezados
    const values: Partial<Record<ColumnKey, unknown>> = {};
    let hasContent = false;
    for (const [colNumber, key] of colMap) {
      let v = plainValue(row.getCell(colNumber).value);
      if (typeof v === "string") v = v.trim() || undefined;
      if (NUMERIC_KEYS.includes(key)) v = coerceNumber(v);
      if (v !== undefined) hasContent = true;
      values[key] = v;
    }
    if (!hasContent) return; // fila vacía
    // Las filas de ejemplo de la plantilla se ignoran si el cliente no las borró.
    if (typeof values.sku === "string" && /^ejemplo/i.test(values.sku)) {
      exampleRowsSkipped++;
      return;
    }
    rows.push({ row: rowNumber, values });
  });

  return { ok: true, rows, exampleRowsSkipped };
}
