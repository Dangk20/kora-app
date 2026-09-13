// Regenera `src/modules/geo/places/co.ts` desde el DIVIPOLA del DANE.
//
//   pnpm geo:places
//
// Fuente: datos.gov.co, conjunto pqwj-3fi4 ("MinSalud Divipola - Municipios"),
// dominio público. A mano, nunca en el build ni al arrancar: la tienda no
// puede depender de que un portal público responda. Misma regla que la tabla
// IP → país.

import { writeFile } from "node:fs/promises";

const URL = "https://www.datos.gov.co/resource/pqwj-3fi4.json?$limit=2000&$select=iddepto,idmupio,nommpio&$order=idmupio";

const DEP: Record<string, string> = {
  "05": "Antioquia", "08": "Atlántico", "11": "Bogotá D.C.", "13": "Bolívar", "15": "Boyacá", "17": "Caldas",
  "18": "Caquetá", "19": "Cauca", "20": "Cesar", "23": "Córdoba", "25": "Cundinamarca", "27": "Chocó",
  "41": "Huila", "44": "La Guajira", "47": "Magdalena", "50": "Meta", "52": "Nariño", "54": "Norte de Santander",
  "63": "Quindío", "66": "Risaralda", "68": "Santander", "70": "Sucre", "73": "Tolima", "76": "Valle del Cauca",
  "81": "Arauca", "85": "Casanare", "86": "Putumayo",
  "88": "Archipiélago de San Andrés, Providencia y Santa Catalina",
  "91": "Amazonas", "94": "Guainía", "95": "Guaviare", "97": "Vaupés", "99": "Vichada",
};

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`datos.gov.co respondió ${res.status}`);
  const filas = (await res.json()) as { iddepto: string; idmupio: string; nommpio: string }[];

  const por = new Map<string, string[]>();
  const capital = new Map<string, string>();
  for (const f of filas) {
    const dep = DEP[f.iddepto];
    if (!dep) throw new Error(`Departamento desconocido: ${f.iddepto}`);
    const nombre = f.nommpio.trim();
    por.set(dep, [...(por.get(dep) ?? []), nombre]);
    if (f.idmupio.endsWith("001")) capital.set(dep, nombre);
  }

  const orden = [...por.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const lineas = [
    "// Municipios de Colombia por departamento — DIVIPOLA (DANE), dominio público.",
    "// Fuente: datos.gov.co, conjunto pqwj-3fi4 (MinSalud Divipola - Municipios),",
    `// descargado el ${new Date().toISOString().slice(0, 10)}: ${filas.length} municipios. La capital va primera; el`,
    "// resto, alfabético.",
    "//",
    "// ⚠️ GENERADO. No editar a mano: regenerar con `pnpm geo:places`.",
    "// Va como TypeScript importado y no como JSON leído del disco: es la lección",
    "// de la tabla IP → país. Lo que el rastreo estático de Next no ve, no viaja.",
    "",
    "export const MUNICIPIOS_CO: Record<string, readonly string[]> = {",
  ];
  for (const dep of orden) {
    const cap = capital.get(dep);
    const resto = (por.get(dep) ?? []).filter((m) => m !== cap).sort((a, b) => a.localeCompare(b, "es"));
    lineas.push(`  ${JSON.stringify(dep)}: ${JSON.stringify(cap ? [cap, ...resto] : resto)},`);
  }
  lineas.push("};", "");
  await writeFile("src/modules/geo/places/co.ts", lineas.join("\n"));
  console.log(`✔ ${orden.length} departamentos, ${filas.length} municipios → src/modules/geo/places/co.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
