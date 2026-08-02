// Exportación de ventas a CSV.
// Ver openspec/changes/modulo-ventas — specs/sales-reporting.
//
// El alcance pide "registro y consulta", no informes analíticos. Exportar es lo
// que permite que el negocio arme el informe que necesite sin que nosotros
// adivinemos cuál.

import { businessDayKey } from "@/lib/business-time";
import type { SaleRow } from "./queries";

const COLUMNAS = [
  "Pedido",
  "Fecha",
  "Cliente",
  "Canal",
  "Moneda",
  "Descuento cupón",
  "Kora Cashback",
  "Total cobrado",
  "Artículos",
] as const;

/**
 * Separador de campo.
 *
 * Punto y coma, no coma: Excel con configuración regional en español espera `;`
 * y con `,` mete toda la fila en una sola columna. El operador abriría el
 * archivo, lo vería ilegible y nos escribiría — y el problema no es el dato.
 */
const SEP = ";";

/**
 * Marca de orden de bytes.
 *
 * Sin ella Excel abre el archivo en su codificación local y se come las tildes:
 * "Bogotá" queda "BogotÃ¡". No es cosmético en un archivo que lleva nombres de
 * clientes.
 */
const BOM = "﻿";

function celda(valor: string | number): string {
  const s = String(valor ?? "");
  // Si el texto trae el separador, comillas o saltos, va entrecomillado.
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * Importe para hoja de cálculo: número puro.
 *
 * Sin símbolo ni separador de miles, y con coma decimal porque es lo que Excel
 * en español entiende como número. Con "$1.234.567" la hoja no puede sumar, y
 * exportar para no poder sumar no sirve de nada. La moneda va en su columna.
 */
function importe(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function salesToCsv(rows: SaleRow[]): string {
  const lineas = [COLUMNAS.join(SEP)];

  for (const r of rows) {
    lineas.push(
      [
        celda(r.number),
        // Fecha del día del negocio: la misma con la que se agrupa y se cierra
        // el mes. En UTC, una venta de la noche saldría fechada al día siguiente.
        celda(businessDayKey(r.confirmedAt)),
        celda(r.customerName ?? ""),
        celda(r.channel === "POS" ? "Punto de venta" : "Online"),
        celda(r.currency),
        celda(importe(r.discountTotal)),
        celda(importe(r.cashbackApplied)),
        celda(importe(r.total)),
        celda(r.items),
      ].join(SEP),
    );
  }

  return BOM + lineas.join("\r\n") + "\r\n";
}

/** Nombre del archivo, con el periodo dentro para no confundir descargas. */
export function csvFilename(from?: Date, to?: Date): string {
  const d = (x?: Date) => (x ? businessDayKey(x) : "");
  const periodo = from || to ? `_${d(from)}_a_${d(to)}` : "";
  return `kora-ventas${periodo}.csv`;
}
