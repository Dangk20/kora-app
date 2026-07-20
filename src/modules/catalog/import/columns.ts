// Definición única de las columnas del Excel de catálogo.
// La plantilla descargable, el parser y la validación salen de aquí:
// si una columna cambia, cambia en un solo lugar.
import { z } from "zod";

export type ColumnKey =
  | "sku"
  | "producto"
  | "categoria"
  | "subcategoria"
  | "variante"
  | "priceCopStore"
  | "priceCopOnline"
  | "priceUsdStore"
  | "priceUsdOnline"
  | "stockInicial"
  | "marca"
  | "barcode"
  | "descripcion";

export type ColumnDef = {
  key: ColumnKey;
  header: string;
  required: boolean;
  width: number;
  hint: string;
};

// Orden acordado con el cliente (bitácora S2): SKU, producto, categoría,
// variante, 4 precios, stock inicial — más opcionales al final.
export const IMPORT_COLUMNS: ColumnDef[] = [
  { key: "sku", header: "SKU", required: true, width: 16, hint: "Código único por variante (no se repite en todo el archivo)" },
  { key: "producto", header: "Producto", required: true, width: 32, hint: "Nombre del producto; filas con el mismo nombre = variantes del mismo producto" },
  { key: "categoria", header: "Categoría", required: true, width: 20, hint: "Si no existe, se crea automáticamente" },
  { key: "subcategoria", header: "Subcategoría", required: false, width: 20, hint: "Opcional; se crea dentro de la categoría" },
  { key: "variante", header: "Variante", required: false, width: 18, hint: 'Ej: "Talla M / Rojo". Vacío = producto sin variantes ("Única")' },
  { key: "priceCopStore", header: "Precio COP tienda", required: true, width: 18, hint: "Número sin puntos ni símbolos. Ej: 85000" },
  { key: "priceCopOnline", header: "Precio COP online", required: true, width: 18, hint: "Número sin puntos ni símbolos" },
  { key: "priceUsdStore", header: "Precio USD tienda", required: true, width: 17, hint: "Puede llevar decimales. Ej: 24.99" },
  { key: "priceUsdOnline", header: "Precio USD online", required: true, width: 17, hint: "Puede llevar decimales" },
  { key: "stockInicial", header: "Stock inicial", required: true, width: 13, hint: "Unidades totales hoy (tienda + online). Entero, 0 si no hay" },
  { key: "marca", header: "Marca", required: false, width: 16, hint: "Opcional" },
  { key: "barcode", header: "Código de barras", required: false, width: 18, hint: "Opcional; único si se usa" },
  { key: "descripcion", header: "Descripción", required: false, width: 42, hint: "Opcional; texto que verá el cliente en la tienda" },
];

/** Normaliza para comparar encabezados y nombres: minúsculas, sin tildes. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const requiredText = (field: string, min = 1) =>
  z
    .string({ error: `Falta ${field}` })
    .trim()
    .min(min, `Falta ${field}`);

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const money = (field: string) =>
  z
    .number({ error: `${field}: debe ser un número` })
    .min(0, `${field}: no puede ser negativo`);

export const importRowSchema = z.object({
  sku: requiredText("el SKU"),
  producto: requiredText("el nombre del producto", 2),
  categoria: requiredText("la categoría", 2),
  subcategoria: optionalText,
  variante: optionalText,
  priceCopStore: money("Precio COP tienda"),
  priceCopOnline: money("Precio COP online"),
  priceUsdStore: money("Precio USD tienda"),
  priceUsdOnline: money("Precio USD online"),
  stockInicial: z
    .number({ error: "Stock inicial: debe ser un número" })
    .int("Stock inicial: debe ser un entero")
    .min(0, "Stock inicial: no puede ser negativo"),
  marca: optionalText,
  barcode: optionalText,
  descripcion: optionalText,
});

export type ImportRow = z.infer<typeof importRowSchema>;
