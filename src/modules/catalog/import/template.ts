// Genera la plantilla .xlsx que se le entrega al cliente: hoja "Catálogo"
// con los encabezados exactos que espera el parser + hoja de instrucciones.
import ExcelJS from "exceljs";
import { IMPORT_COLUMNS } from "./columns";

const KORA_ORANGE = "FFFF6A00"; // ARGB del naranja del manual (#FF6A00)
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

const EXAMPLE_ROWS: (string | number)[][] = [
  ["EJEMPLO-001", "Camiseta Kora Essential", "Ropa", "Camisetas", "Talla M / Negro", 85000, 79000, 24, 22, 10, "KORA", "7701234567890", "Camiseta de algodón peinado 220 g."],
  ["EJEMPLO-002", "Camiseta Kora Essential", "Ropa", "Camisetas", "Talla L / Negro", 85000, 79000, 24, 22, 8, "KORA", "7701234567891", ""],
  ["EJEMPLO-003", "Vela aromática lavanda", "Hogar", "", "", 45000, 42000, 12.5, 11.5, 25, "", "", "Vela artesanal de 200 g, 40 horas de duración."],
];

export async function buildCatalogTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KORA";

  const sheet = wb.addWorksheet("Catálogo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = IMPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KORA_ORANGE } };
    cell.alignment = { vertical: "middle" };
  });

  for (const row of EXAMPLE_ROWS) {
    const r = sheet.addRow(row);
    r.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF9AA0AB" } };
    });
  }

  const info = wb.addWorksheet("Instrucciones");
  info.columns = [{ width: 4 }, { width: 100 }];
  const lines: [string, string][] = [
    ["", "CÓMO LLENAR EL CATÁLOGO KORA"],
    ["", ""],
    ["1", "Cada fila es una variante vendible (un SKU). Un producto con tallas o colores ocupa una fila por variante, repitiendo el mismo nombre en \"Producto\"."],
    ["2", "Las filas grises son ejemplos: bórralas antes de subir el archivo (si quedan, el sistema las ignora)."],
    ["3", "No cambies los nombres de los encabezados ni el orden de la hoja \"Catálogo\"."],
    ["4", "Precios: solo números, sin puntos de miles ni símbolos ($). COP sin decimales (85000); USD puede llevar decimales (24.99)."],
    ["5", "\"Stock inicial\" son las unidades totales que hay HOY entre tienda física y bodega. Si aún no hay, pon 0."],
    ["6", "\"Categoría\" y \"Subcategoría\": si no existen en el sistema, se crean automáticamente con ese nombre — revisa la ortografía para no crear duplicadas."],
    ["7", "El SKU no se puede repetir en el archivo ni entre productos. Si un SKU ya existe en el sistema, se actualizan sus precios (el stock no se toca)."],
    ["", ""],
    ["", "Columnas obligatorias: " + IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header).join(" · ")],
    ["", "Columnas opcionales: " + IMPORT_COLUMNS.filter((c) => !c.required).map((c) => c.header).join(" · ")],
    ["", ""],
    ...IMPORT_COLUMNS.map((c): [string, string] => ["•", `${c.header}: ${c.hint}`]),
  ];
  for (const [n, text] of lines) {
    const r = info.addRow([n, text]);
    if (text === "CÓMO LLENAR EL CATÁLOGO KORA") {
      r.font = { bold: true, size: 14, color: { argb: KORA_ORANGE } };
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
