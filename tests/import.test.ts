// Importador de catálogo (S3). Lo crítico que se prueba aquí:
//   1. La plantilla que descarga el cliente se puede volver a leer (round-trip).
//   2. La importación es TODO-O-NADA: un error en la fila 5 no deja nada escrito.
//   3. El stock inicial entra por el libro contable — nunca por fuera del motor.
//   4. Re-importar el mismo archivo no duplica inventario.
import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { findLedgerMismatches } from "@/modules/inventory/engine";
import { IMPORT_COLUMNS } from "@/modules/catalog/import/columns";
import { validateRows, runImport } from "@/modules/catalog/import/import";
import { parseCatalogWorkbook } from "@/modules/catalog/import/parse";
import { buildCatalogTemplate } from "@/modules/catalog/import/template";

const PREFIX = "TEST-IMP-";
const CATEGORY = "Categoría Test Importación";

type Row = Record<string, string | number | undefined>;

/** Construye un .xlsx con los encabezados reales de la plantilla. */
async function workbookOf(rows: Row[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Catálogo");
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key }));
  for (const r of rows) sheet.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function row(overrides: Row = {}): Row {
  return {
    sku: `${PREFIX}001`,
    producto: "Producto Importado A",
    categoria: CATEGORY,
    variante: "Única",
    priceCopStore: 50000,
    priceCopOnline: 47000,
    priceUsdStore: 14,
    priceUsdOnline: 13,
    stockInicial: 10,
    ...overrides,
  };
}

async function adminId() {
  const admin = await db.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
  return admin.id;
}

/** Parsea y ejecuta como lo haría la Server Action. */
async function importWorkbook(rows: Row[]) {
  const parsed = await parseCatalogWorkbook(await workbookOf(rows));
  if (!parsed.ok) throw new Error(`parse falló: ${parsed.error}`);
  return runImport(parsed.rows, await adminId(), parsed.exampleRowsSkipped);
}

async function cleanup() {
  await db.stockMovement.deleteMany({ where: { variant: { sku: { startsWith: PREFIX } } } });
  await db.variant.deleteMany({ where: { sku: { startsWith: PREFIX } } });
  await db.product.deleteMany({ where: { name: { startsWith: "Producto Importado" } } });
  await db.category.deleteMany({ where: { name: { startsWith: "Categoría Test" } } });
  await db.category.deleteMany({ where: { name: { startsWith: "Subcategoría Test" } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("plantilla de catálogo", () => {
  it("la plantilla que descarga el cliente se puede leer de vuelta", async () => {
    const parsed = await parseCatalogWorkbook(await buildCatalogTemplate());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // Solo trae filas de ejemplo, y el parser las descarta.
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.exampleRowsSkipped).toBe(3);
  });

  it("rechaza un archivo al que le falta una columna obligatoria", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Catálogo");
    sheet.addRow(["SKU", "Producto"]); // sin categoría ni precios
    sheet.addRow([`${PREFIX}001`, "X"]);
    const parsed = await parseCatalogWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("Faltan columnas");
    expect(parsed.error).toContain("Categoría");
  });

  it("rechaza un archivo que no es Excel", async () => {
    const parsed = await parseCatalogWorkbook(Buffer.from("esto no es un xlsx"));
    expect(parsed).toEqual({ ok: false, error: "El archivo no es un Excel válido (.xlsx)" });
  });
});

describe("validación (antes de tocar la base)", () => {
  const rowsOf = async (rows: Row[]) => {
    const parsed = await parseCatalogWorkbook(await workbookOf(rows));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.rows;
  };

  it("acepta precios como los escribe la gente: $ 85.000 y 24,99", async () => {
    const rows = await rowsOf([
      row({ priceCopStore: "$ 85.000", priceCopOnline: "79.000", priceUsdStore: "24,99", priceUsdOnline: "22,50" }),
    ]);
    const result = validateRows(rows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].data.priceCopStore).toBe(85000);
    expect(result.rows[0].data.priceUsdStore).toBe(24.99);
  });

  it("reporta el número de fila real del Excel", async () => {
    const rows = await rowsOf([
      row({ sku: `${PREFIX}001` }),
      row({ sku: `${PREFIX}002`, priceCopOnline: "no es un precio" }),
    ]);
    const result = validateRows(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Fila 1 = encabezados, así que la segunda fila de datos es la 3.
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].message).toContain("Precio COP online");
  });

  it("detecta SKUs repetidos dentro del archivo", async () => {
    const rows = await rowsOf([
      row({ sku: `${PREFIX}009` }),
      row({ sku: `${PREFIX}009`, variante: "Otra" }),
    ]);
    const result = validateRows(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("repetido");
  });

  it("exige que las variantes de un producto compartan categoría", async () => {
    const rows = await rowsOf([
      row({ sku: `${PREFIX}001`, categoria: CATEGORY }),
      row({ sku: `${PREFIX}002`, categoria: "Categoría Test Otra" }),
    ]);
    const result = validateRows(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("deben compartir categoría");
  });

  it("rechaza stock inicial negativo o decimal", async () => {
    const negativo = validateRows(await rowsOf([row({ stockInicial: -3 })]));
    expect(negativo.ok).toBe(false);
    const decimal = validateRows(await rowsOf([row({ sku: `${PREFIX}002`, stockInicial: 2.5 })]));
    expect(decimal.ok).toBe(false);
  });
});

describe("importación", () => {
  it("crea producto, variantes y categorías; el stock entra por el libro contable", async () => {
    const result = await importWorkbook([
      row({ sku: `${PREFIX}001`, variante: "Talla M", stockInicial: 10 }),
      row({ sku: `${PREFIX}002`, variante: "Talla L", stockInicial: 4 }),
      row({
        sku: `${PREFIX}003`,
        producto: "Producto Importado B",
        categoria: CATEGORY,
        subcategoria: "Subcategoría Test A",
        stockInicial: 0,
      }),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toMatchObject({
      productsCreated: 2,
      variantsCreated: 3,
      variantsUpdated: 0,
      unitsReceived: 14,
    });

    const variant = await db.variant.findUniqueOrThrow({
      where: { sku: `${PREFIX}001` },
      include: { stockMovements: true, product: { include: { category: true } } },
    });
    expect(variant.stockActual).toBe(10);
    expect(variant.onlineUnits).toBe(10); // default: todo publicado online
    // La única vía del stock es el ledger: un movimiento COMPRA_INICIAL de +10.
    expect(variant.stockMovements).toHaveLength(1);
    expect(variant.stockMovements[0]).toMatchObject({ delta: 10, reason: "COMPRA_INICIAL", channel: "ADMIN" });
    expect(variant.product.category.name).toBe(CATEGORY);

    // La subcategoría cuelga de la categoría raíz, no de la raíz del árbol.
    const sub = await db.category.findFirstOrThrow({
      where: { name: "Subcategoría Test A" },
      include: { parent: true },
    });
    expect(sub.parent?.name).toBe(CATEGORY);

    expect(await findLedgerMismatches()).toEqual([]);
  });

  it("TODO-O-NADA: un error en la última fila no deja nada escrito", async () => {
    const before = await db.variant.count();
    const result = await importWorkbook([
      row({ sku: `${PREFIX}001` }),
      row({ sku: `${PREFIX}002`, variante: "B" }),
      row({ sku: `${PREFIX}003`, variante: "C", priceCopStore: -100 }), // inválida
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].row).toBe(4);
    // Ni la fila 2 ni la 3, que sí eran válidas, quedaron en la base.
    expect(await db.variant.count()).toBe(before);
    expect(await db.variant.count({ where: { sku: { startsWith: PREFIX } } })).toBe(0);
    expect(await db.category.count({ where: { name: CATEGORY } })).toBe(0);
  });

  it("re-importar el mismo archivo actualiza precios y NO duplica stock", async () => {
    const rows = [row({ sku: `${PREFIX}001`, stockInicial: 10 })];
    const first = await importWorkbook(rows);
    expect(first.ok).toBe(true);

    const second = await importWorkbook([
      row({ sku: `${PREFIX}001`, stockInicial: 999, priceCopOnline: 41000 }),
    ]);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.summary).toMatchObject({
      variantsCreated: 0,
      variantsUpdated: 1,
      productsCreated: 0,
      unitsReceived: 0, // el stock de un SKU existente jamás se re-suma
    });

    const variant = await db.variant.findUniqueOrThrow({
      where: { sku: `${PREFIX}001` },
      include: { stockMovements: true },
    });
    expect(variant.stockActual).toBe(10);
    expect(variant.stockMovements).toHaveLength(1);
    expect(Number(variant.priceCopOnline)).toBe(41000);

    // Y la categoría no se duplicó al repetir el nombre.
    expect(await db.category.count({ where: { name: CATEGORY } })).toBe(1);
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it("no crea la categoría dos veces cuando varias filas la repiten", async () => {
    const result = await importWorkbook([
      row({ sku: `${PREFIX}001` }),
      row({ sku: `${PREFIX}002`, producto: "Producto Importado B" }),
      row({ sku: `${PREFIX}003`, producto: "Producto Importado C", categoria: CATEGORY.toUpperCase() }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.categoriesCreated).toBe(1);
    expect(await db.category.count({ where: { name: { startsWith: "Categoría Test" } } })).toBe(1);
  });
});
