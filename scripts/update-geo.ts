// Regenera la tabla IP → origen del módulo de geolocalización.
//
//   pnpm geo:update
//
// Descarga la fuente de dominio público, la reduce a lo que este producto
// necesita y escribe src/modules/geo/tabla.ts. NO corre en el build ni en el
// arranque: se ejecuta a mano y su resultado entra al repositorio como un
// cambio que alguien revisa en un diff.
//
// Ver openspec/changes/deteccion-moneda-por-ip — design.md decisiones 1, 2, 3 y 6.

import { writeFileSync } from "node:fs";

const FUENTE_V4 =
  "https://cdn.jsdelivr.net/npm/@ip-location-db/geo-whois-asn-country/geo-whois-asn-country-ipv4.csv";
const FUENTE_V6 =
  "https://cdn.jsdelivr.net/npm/@ip-location-db/geo-whois-asn-country/geo-whois-asn-country-ipv6.csv";
const DESTINO = "src/modules/geo/tabla.ts";

type Rango = { desde: bigint; hasta: bigint; colombia: boolean };

function ipv4ANumero(texto: string): bigint {
  const partes = texto.split(".");
  if (partes.length !== 4) throw new Error(`IPv4 inválida: ${texto}`);
  return partes.reduce((acc, p) => (acc << 8n) + BigInt(Number(p)), 0n);
}

function ipv6ANumero(texto: string): bigint {
  const [izquierda, derecha = ""] = texto.split("::");
  const cabeza = izquierda ? izquierda.split(":") : [];
  const cola = derecha ? derecha.split(":") : [];
  const relleno = new Array(8 - cabeza.length - cola.length).fill("0");
  const grupos = texto.includes("::") ? [...cabeza, ...relleno, ...cola] : cabeza;
  if (grupos.length !== 8) throw new Error(`IPv6 inválida: ${texto}`);
  return grupos.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || "0", 16)), 0n);
}

async function descargar(url: string): Promise<string> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${url} respondió ${respuesta.status}`);
  return respuesta.text();
}

function leer(csv: string, aNumero: (t: string) => bigint): Rango[] {
  const rangos: Rango[] = [];
  for (const linea of csv.split("\n")) {
    if (!linea) continue;
    const [desde, hasta, pais] = linea.split(",");
    if (!desde || !hasta || !pais) continue;
    rangos.push({
      desde: aNumero(desde.trim()),
      hasta: aNumero(hasta.trim()),
      colombia: pais.trim().toUpperCase() === "CO",
    });
  }
  rangos.sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  return rangos;
}

/**
 * Une rangos CONTIGUOS de la misma marca. Los huecos —espacio sin asignar a
 * ningún país— se dejan intactos a propósito: son la respuesta "no sé", y son
 * lo que impide que un bloque colombiano asignado después de esta instantánea
 * empuje a un colombiano a ver dólares (design §2).
 */
function colapsar(rangos: Rango[]): Rango[] {
  const salida: Rango[] = [];
  for (const r of rangos) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.colombia === r.colombia && ultimo.hasta + 1n === r.desde) {
      ultimo.hasta = r.hasta > ultimo.hasta ? r.hasta : ultimo.hasta;
    } else {
      salida.push({ ...r });
    }
  }
  return salida;
}

/** `hueco:tamaño` en base 36, más `c`/`x` si la marca importa. */
function codificar(rangos: Rango[], conMarca: boolean): string {
  let anterior = -1n;
  const partes: string[] = [];
  for (const r of rangos) {
    const hueco = r.desde - anterior - 1n;
    const tamano = r.hasta - r.desde;
    partes.push(
      `${hueco.toString(36)}:${tamano.toString(36)}${conMarca ? (r.colombia ? "c" : "x") : ""}`,
    );
    anterior = r.hasta;
  }
  return partes.join(",");
}

async function main(): Promise<void> {
  console.log("Descargando la fuente…");
  const [csv4, csv6] = await Promise.all([descargar(FUENTE_V4), descargar(FUENTE_V6)]);

  const v4 = colapsar(leer(csv4, ipv4ANumero));
  // IPv6: solo Colombia. Conservar los huecos costaría ~60.000 rangos por la
  // fragmentación del espacio asignado, y no compra nada que este catálogo
  // necesite (design §3).
  const v6 = colapsar(leer(csv6, ipv6ANumero).filter((r) => r.colombia));

  const instantanea = new Date().toISOString().slice(0, 10);
  const archivo = `// GENERADO por \`pnpm geo:update\` — no editar a mano.
//
// Fuente: https://github.com/sapics/ip-location-db, variante
// geo-whois-asn-country (dominio público, CC0). Instantánea del ${instantanea}.
//
// Formato: rangos ordenados, cada uno \`hueco:tamaño\` en base 36 —el hueco es la
// distancia desde el final del rango anterior— separados por comas. En IPv4 cada
// rango lleva además su marca: \`c\` Colombia, \`x\` resto del mundo; los HUECOS
// entre rangos son espacio sin asignar y significan "no sé" (design §2).
// En IPv6 solo se listan los rangos colombianos (design §3).

export const INSTANTANEA = "${instantanea}";
export const RANGOS_V4 = ${v4.length};
export const RANGOS_V6_CO = ${v6.length};

export const V4 =
  "${codificar(v4, true)}";

export const V6_CO =
  "${codificar(v6, false)}";
`;

  writeFileSync(DESTINO, archivo);
  const kb = Math.round(Buffer.byteLength(archivo) / 1024);
  console.log(
    `\n✔ ${DESTINO} — ${v4.length} rangos IPv4, ${v6.length} rangos IPv6 colombianos, ${kb} KB.\n`,
  );
}

main().catch((error) => {
  console.error(`\n✖ No se pudo regenerar la tabla: ${String(error)}\n`);
  process.exit(1);
});
