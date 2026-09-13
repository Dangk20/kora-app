// Regenera `src/modules/geo/places/us.ts` desde el Gazetteer del Census Bureau.
//
//   pnpm geo:places:us
//
// Fuente: U.S. Census Bureau, "Gazetteer Files — Places (national)", dominio
// público. Son TODOS los lugares del Census: ciudades, pueblos, villas,
// boroughs, comunidades de Puerto Rico y los CDP (lugares no incorporados
// que el Census delimita para el censo: donde vive gente, aunque no tengan
// alcalde). Quitar los CDP dejaría fuera medio Florida — Kendall, Brandon,
// The Villages son CDP. Se quitan los "(balance)" y las entradas
// "consolidated government", que son artificios estadísticos.
//
// El sufijo del tipo ("Miami city", "Kendall CDP") se recorta: el comprador
// escribe "Miami". A mano, nunca en el build ni al arrancar.

import { writeFile } from "node:fs/promises";

const URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip";

const SUFIJOS = /\s+(city|town|village|borough|CDP|municipality|comunidad|zona urbana|city and borough|metro township|metropolitan government|consolidated government|unified government|urban county|county)$/i;

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`census.gov respondió ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  // El zip trae un solo .txt; se extrae con el descompresor del sistema.
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readFileSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "gaz-"));
  writeFileSync(join(dir, "gaz.zip"), zip);
  execFileSync("unzip", ["-o", "-q", join(dir, "gaz.zip"), "-d", dir]);
  const texto = readFileSync(join(dir, "2024_Gaz_place_national.txt"), "latin1");

  const lineas = texto.split("\n");
  const cab = lineas[0].split("\t").map((c) => c.trim());
  const iUSPS = cab.indexOf("USPS"), iNAME = cab.indexOf("NAME"), iLSAD = cab.indexOf("LSAD");

  const por = new Map<string, Set<string>>();
  let total = 0;
  for (const l of lineas.slice(1)) {
    const c = l.split("\t");
    if (c.length < 4) continue;
    const st = c[iUSPS].trim();
    let nombre = c[iNAME].trim();
    if (/\(balance\)/i.test(nombre)) continue;
    if (c[iLSAD].trim() === "UG" || /consolidated|unified government|metropolitan government/i.test(nombre)) continue;
    nombre = nombre.replace(SUFIJOS, "").trim();
    if (!nombre) continue;
    if (!por.has(st)) por.set(st, new Set());
    por.get(st)!.add(nombre);
    total += 1;
  }

  const salida = [
    "// Lugares de EE.UU. por estado — Gazetteer del U.S. Census Bureau, dominio público.",
    `// Fuente: census.gov, Gazetteer Files 2024 (places, national), descargado el ${new Date().toISOString().slice(0, 10)}:`,
    `// ${total} lugares en ${por.size} estados y territorios, alfabético. Incluye los CDP.`,
    "//",
    "// ⚠️ GENERADO. No editar a mano: regenerar con `pnpm geo:places:us`.",
    "// Va como TypeScript importado y no como JSON leído del disco: es la lección",
    "// de la tabla IP → país. Lo que el rastreo estático de Next no ve, no viaja.",
    "",
    "export const CITIES_US: Record<string, readonly string[]> = {",
  ];
  for (const st of [...por.keys()].sort()) {
    const lista = [...por.get(st)!].sort((a, b) => a.localeCompare(b, "en"));
    salida.push(`  ${st}: ${JSON.stringify(lista)},`);
  }
  salida.push("};", "");
  await writeFile("src/modules/geo/places/us.ts", salida.join("\n"));
  console.log(`✔ ${por.size} estados, ${total} lugares → src/modules/geo/places/us.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
