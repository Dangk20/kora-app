// Importa el inventario del cliente desde SU Excel, no desde nuestra plantilla.
//
//   pnpm catalog:import <archivo.xlsx> --fotos <carpeta> [--hoja "…"] [--actor admin@kora.local] [--simular]
//
// El archivo "INVENTARIO - PRODUCTOS KORASHOPP.COM.xlsx" (12 sep 2026) tiene
// una hoja por línea (KHR hombre, KMR mujer, KNR niña) con SUS columnas:
// Referencia, Marca, Producto / Descripccion, Tipo, Talla, Categoría,
// Cantidad, PRECIO VENTA PESOS CO, PRECIO VENTA USD, Stock Actual, Estado,
// Notas. Este script las TRADUCE a las de nuestra plantilla (`columns.ts`) y
// entra por el mismo `runImport` del panel: mismas validaciones, mismo motor
// de inventario, misma regla de que un SKU repetido actualiza precios y JAMÁS
// vuelve a sumar stock. Es un adaptador para este cliente, no un segundo
// importador.
//
// Lo que se decidió al leer su archivo, y por qué:
//   · CADA REFERENCIA ES UN PRODUCTO. Son piezas únicas de una sola talla
//     (cantidad 1-3), no un modelo con tallas. Agrupar por nombre —que es lo
//     que hace la plantilla— fundiría "Camiseta hombre blanca" de DKNY con la
//     de otra marca en un solo producto con dos tallas, y cada referencia tiene
//     su propia carpeta de fotos. El importador agrupa por nombre Y marca
//     desde el 12 sep; si aun así dos referencias coinciden, se avisa.
//   · La talla va como nombre de la variante ("Talla M"): así la ficha, el
//     carrito y el mensaje de WhatsApp la enseñan sin tocar nada.
//   · Categoría = Tipo (Hombre / Mujer / Niña); subcategoría = la prenda,
//     deducida de la primera palabra del nombre. Es una heurística: se corrige
//     en el panel si falla.
//   · Un solo precio por moneda → tienda y online iguales.
//   · Estado vacío = activo. Solo "Inactivo" se omite.
//   · Una fila sin nombre NI precio es una fila a medio llenar: se OMITE y se
//     reporta, en vez de tumbar el archivo entero. Una fila con nombre pero sin
//     precio sí se reporta como error, porque es un producto que no se puede
//     vender.
//   · Una talla que Excel convirtió en FECHA ("10-12" → 2026-12-10) se reporta
//     y el producto entra sin talla: adivinarla sería peor.
//   · SOLO ENTRAN LAS REFERENCIAS CON FOTOS (decisión de Daniel, 12 sep): un
//     producto sin foto en la tienda es una tarjeta vacía. `--fotos` apunta a
//     la carpeta del Drive; una referencia sin carpeta, o con la carpeta
//     vacía, se omite y se reporta. Cuando lleguen sus fotos, se vuelve a
//     correr y entra.

import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import type { ColumnKey } from "../src/modules/catalog/import/columns";
import { runImport } from "../src/modules/catalog/import/import";
import { ensureVariantOption } from "../src/modules/catalog/import/options";
import type { RawRow } from "../src/modules/catalog/import/parse";

type Fila = { row: number; v: Record<string, unknown> };

const PRENDA: Record<string, string> = {
  camiseta: "Camisetas", camisetas: "Camisetas", camisa: "Camisas", camisas: "Camisas",
  pantaloneta: "Pantalonetas", pantalonetas: "Pantalonetas", pantalon: "Pantalones", pantalón: "Pantalones",
  jean: "Jeans", jeans: "Jeans", short: "Shorts", shorts: "Shorts", blusa: "Blusas", blusas: "Blusas",
  vestido: "Vestidos", vestidos: "Vestidos", falda: "Faldas", faldas: "Faldas", conjunto: "Conjuntos",
  set: "Sets", chaqueta: "Chaquetas", buzo: "Buzos", sudadera: "Sudaderas", leggins: "Leggins", legging: "Leggins",
  gorra: "Gorras", zapatos: "Zapatos", tenis: "Tenis", sandalias: "Sandalias", bolso: "Bolsos",
};

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `FECHA:${v.toISOString().slice(0, 10)}`;
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.text) return String(o.text).trim();
    if ("result" in o) return texto(o.result);
    return "";
  }
  return String(v).trim();
}

function numero(v: unknown): number | undefined {
  // Una celda numérica ya viene como número: no se toca. Quitarle el punto
  // convertía 16.36 USD en 1636 — el punto es decimal, no de miles.
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (v && typeof v === "object" && "result" in (v as object)) return numero((v as { result: unknown }).result);
  const t = texto(v).replace(/[$\s]/g, "");
  if (!t) return undefined;
  // Texto: "62.150" (miles con punto, estilo CO) o "16,36" (decimal con coma).
  const conMiles = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t);
  const n = Number(conMiles ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Cabecera: la fila que contiene "Referencia". Sus celdas, normalizadas, son las claves. */
function leerHoja(ws: ExcelJS.Worksheet): { filas: Fila[]; columnas: string[] } | null {
  let cabecera: number | null = null;
  let columnas: string[] = [];
  ws.eachRow((row, i) => {
    if (cabecera !== null) return;
    const vals = row.values as unknown[];
    const idx = vals.findIndex((c) => texto(c).toLowerCase() === "referencia");
    if (idx >= 0) {
      cabecera = i;
      columnas = vals.map((c) => texto(c).toLowerCase());
    }
  });
  if (cabecera === null) return null;
  const filas: Fila[] = [];
  ws.eachRow((row, i) => {
    if (i <= cabecera!) return;
    const vals = row.values as unknown[];
    const v: Record<string, unknown> = {};
    columnas.forEach((c, j) => { if (c) v[c] = vals[j]; });
    filas.push({ row: i, v });
  });
  return { filas, columnas };
}

function col(v: Record<string, unknown>, ...nombres: string[]): unknown {
  for (const n of nombres) {
    const k = Object.keys(v).find((c) => c.includes(n));
    if (k !== undefined) return v[k];
  }
  return undefined;
}

/** Referencias que tienen al menos una foto en la carpeta del Drive. */
function referenciasConFotos(raiz: string): Set<string> {
  const out = new Set<string>();
  for (const e of readdirSync(raiz, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const fotos = readdirSync(join(raiz, e.name)).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f) && statSync(join(raiz, e.name, f)).size > 0);
    if (fotos.length > 0) out.add(normalizarReferencia(e.name));
  }
  return out;
}

function normalizarReferencia(r: string): string {
  return r.toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
}

function subcategoriaDe(nombre: string): string {
  const primera = nombre.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") ?? "";
  if (PRENDA[primera]) return PRENDA[primera];
  const original = nombre.trim().split(/\s+/)[0] ?? "";
  return original ? original[0].toUpperCase() + original.slice(1).toLowerCase() : "";
}

async function main() {
  const args = process.argv.slice(2);
  const archivo = args.find((a) => !a.startsWith("--"));
  const hoja = args.includes("--hoja") ? args[args.indexOf("--hoja") + 1] : null;
  const actorEmail = args.includes("--actor") ? args[args.indexOf("--actor") + 1] : "admin@kora.local";
  const simular = args.includes("--simular");
  const carpetaFotos = args.includes("--fotos") ? args[args.indexOf("--fotos") + 1] : null;
  if (!archivo || !carpetaFotos) {
    console.error('Uso: pnpm catalog:import <archivo.xlsx> --fotos <carpeta> [--hoja "nombre"] [--actor correo] [--simular]');
    process.exit(1);
  }
  const conFotos = referenciasConFotos(carpetaFotos);
  let omitidasSinFotos = 0;

  const actor = await db.user.findUnique({ where: { email: actorEmail } });
  if (!actor) { console.error(`No existe el usuario ${actorEmail}.`); process.exit(1); }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);

  const raw: RawRow[] = [];
  const avisos: string[] = [];
  const nombresVistos = new Map<string, number>(); // nombre normalizado → veces
  let omitidasIncompletas = 0;

  for (const ws of wb.worksheets) {
    if (hoja && ws.name !== hoja) continue;
    const leida = leerHoja(ws);
    if (!leida) { avisos.push(`Hoja "${ws.name}": sin fila de cabecera con "Referencia" — omitida.`); continue; }

    const conRef = leida.filas.filter((f) => texto(col(f.v, "referencia")));
    const conPrecio = conRef.filter((f) => numero(col(f.v, "precio venta pesos", "pesos")) !== undefined);
    if (conRef.length > 0 && conPrecio.length === 0) {
      avisos.push(`Hoja "${ws.name}": ${conRef.length} referencias y NINGUNA con precio — omitida entera (todavía no está lista).`);
      continue;
    }

    for (const f of conRef) {
      const ref = normalizarReferencia(texto(col(f.v, "referencia")));
      const nombre = texto(col(f.v, "producto"));
      const cop = numero(col(f.v, "precio venta pesos", "pesos"));
      const usd = numero(col(f.v, "precio venta usd", "usd"));
      const estado = texto(col(f.v, "estado")).toLowerCase();

      if (!nombre && cop === undefined) { omitidasIncompletas += 1; continue; }
      if (!conFotos.has(ref)) { omitidasSinFotos += 1; avisos.push(`${ref} (fila ${f.row}): sin fotos en el Drive — no se crea hasta que las tenga.`); continue; }
      if (estado === "inactivo") { avisos.push(`${ref} (fila ${f.row}): Estado "Inactivo" — omitida.`); continue; }

      const marca = texto(col(f.v, "marca"));
      const tipo = texto(col(f.v, "tipo"));
      let talla = texto(col(f.v, "talla"));
      if (talla.startsWith("FECHA:")) {
        avisos.push(`${ref} (fila ${f.row}): la talla es una FECHA (${talla.slice(6)}) — Excel convirtió algo como "10-12". Entra SIN talla; corregir la celda como texto.`);
        talla = "";
      }
      const stock = numero(col(f.v, "stock actual")) ?? numero(col(f.v, "cantidad")) ?? 0;

      // El importador agrupa por nombre Y marca. Dos referencias con el mismo
      // nombre y la misma marca serían un producto con dos tallas — aquí,
      // piezas distintas con fotos distintas. Se avisa; no se inventa nada.
      const clave = `${nombre.toLowerCase()}|${marca.toLowerCase()}`;
      const veces = (nombresVistos.get(clave) ?? 0) + 1;
      nombresVistos.set(clave, veces);
      const nombreFinal = nombre;
      if (veces > 1) avisos.push(`${ref} (fila ${f.row}): "${nombre}" de ${marca || "sin marca"} se repite — se agrupará con la otra referencia como una talla más.`);

      const values: Partial<Record<ColumnKey, unknown>> = {
        sku: ref,
        producto: nombreFinal,
        categoria: tipo || "General",
        subcategoria: subcategoriaDe(nombre),
        variante: talla ? `Talla ${talla}` : "",
        priceCopStore: cop,
        priceCopOnline: cop,
        priceUsdStore: usd,
        priceUsdOnline: usd,
        stockInicial: stock,
        marca,
        descripcion: texto(col(f.v, "notas")),
      };
      raw.push({ row: f.row, values });
    }
  }

  console.log(`\nFilas a importar: ${raw.length} · incompletas omitidas: ${omitidasIncompletas} · sin fotos omitidas: ${omitidasSinFotos}`);
  for (const a of avisos) console.log(`  ⚠ ${a}`);

  if (simular) {
    console.log("\n(simulación: no se escribió nada)\n");
    for (const r of raw.slice(0, 5)) console.log("  ", JSON.stringify(r.values));
    await db.$disconnect();
    return;
  }

  const r = await runImport(raw, actor.id, 0);
  if (!r.ok) {
    console.error("\n✖ El importador rechazó el archivo. No se escribió nada:");
    for (const e of r.errors.slice(0, 30)) console.error(`  fila ${e.row}: ${e.message}`);
    if (r.errors.length > 30) console.error(`  … y ${r.errors.length - 30} más`);
    await db.$disconnect();
    process.exit(1);
  }
  console.log("\n✔ Importado:", JSON.stringify(r.summary));

  // La talla como OPCIÓN (Talla → M), no solo como nombre de la variante:
  // así el panel la enseña con el grupo activado y la ficha puede mostrarla.
  let opciones = 0;
  for (const fila of raw) {
    const talla = String(fila.values.variante ?? "").replace(/^Talla\s+/i, "").trim();
    if (!talla) continue;
    const v = await db.variant.findFirst({ where: { sku: String(fila.values.sku) }, select: { id: true } });
    if (!v) continue;
    const res = await db.$transaction((tx) => ensureVariantOption(tx, v.id, "Talla", talla));
    if (res.created) opciones += 1;
  }
  console.log(`✔ Tallas como opción: ${opciones} enlazadas (el resto ya estaban).`);
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
