// Búsqueda de una IP en la tabla vendorizada.
//
// Ver openspec/changes/deteccion-moneda-por-ip — design.md decisiones 2, 3 y 6.

import { aNumero, sinOrigenGeografico, type IpNumerica } from "./ip";
import { V4, V6_CO } from "./tabla";

/**
 * De dónde entra el visitante. `desconocido` es una respuesta legítima y
 * DISTINTA de `exterior`: significa "no lo sé", y nunca se disfraza de país.
 */
export type Origen = "colombia" | "exterior" | "desconocido";

type TablaV4 = { inicio: Uint32Array; fin: Uint32Array; colombia: Uint8Array };
type TablaV6 = { inicio: bigint[]; fin: bigint[] };

let v4: TablaV4 | null = null;
let v6: TablaV6 | null = null;

/** Base 36 → entero de 128 bits. `BigInt()` no acepta base. */
function desdeBase36(texto: string): bigint {
  let valor = 0n;
  for (const caracter of texto) {
    valor = valor * 36n + BigInt(parseInt(caracter, 36));
  }
  return valor;
}

// El parseo es PEREZOSO: la tabla son ~125 KB de texto y la mayoría de los
// procesos que importan este módulo (el worker, los scripts, el build) nunca
// resuelven una IP. Se paga una vez, en la primera visita que lo necesite.
function tablaV4(): TablaV4 {
  if (v4) return v4;
  const partes = V4.split(",");
  const inicio = new Uint32Array(partes.length);
  const fin = new Uint32Array(partes.length);
  const colombia = new Uint8Array(partes.length);
  let anterior = -1;
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const marca = parte[parte.length - 1];
    const [hueco, tamano] = parte.slice(0, -1).split(":");
    const desde = anterior + parseInt(hueco, 36) + 1;
    const hasta = desde + parseInt(tamano, 36);
    inicio[i] = desde;
    fin[i] = hasta;
    colombia[i] = marca === "c" ? 1 : 0;
    anterior = hasta;
  }
  v4 = { inicio, fin, colombia };
  return v4;
}

function tablaV6(): TablaV6 {
  if (v6) return v6;
  const inicio: bigint[] = [];
  const fin: bigint[] = [];
  let anterior = -1n;
  for (const parte of V6_CO.split(",")) {
    const [hueco, tamano] = parte.split(":");
    const desde = anterior + desdeBase36(hueco) + 1n;
    const hasta = desde + desdeBase36(tamano);
    inicio.push(desde);
    fin.push(hasta);
    anterior = hasta;
  }
  v6 = { inicio, fin };
  return v6;
}

/** Índice del último rango que empieza en o antes de `valor`; -1 si ninguno. */
function bisectarV4(inicio: Uint32Array, valor: number): number {
  let bajo = 0;
  let alto = inicio.length - 1;
  let encontrado = -1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    if (inicio[medio] <= valor) {
      encontrado = medio;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  return encontrado;
}

function bisectarV6(inicio: bigint[], valor: bigint): number {
  let bajo = 0;
  let alto = inicio.length - 1;
  let encontrado = -1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    if (inicio[medio] <= valor) {
      encontrado = medio;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  return encontrado;
}

export function origenDeIpNumerica(ip: IpNumerica): Origen {
  if (sinOrigenGeografico(ip)) return "desconocido";

  if (ip.version === 4) {
    const tabla = tablaV4();
    const i = bisectarV4(tabla.inicio, ip.valor);
    // Fuera de todo rango: la IP cae en un HUECO de la instantánea, espacio
    // sin asignar a ningún país. Eso es "no sé", no "extranjero" — y es lo
    // que hace que un bloque colombiano asignado después de esta instantánea
    // envejezca hacia COP y no hacia una tienda en dólares (design §2).
    if (i < 0 || ip.valor > tabla.fin[i]) return "desconocido";
    return tabla.colombia[i] === 1 ? "colombia" : "exterior";
  }

  // IPv6: la tabla SOLO lleva los rangos colombianos. Confirmar Colombia sí;
  // confirmar "exterior" no. Todo lo demás es "no sé" y se sirve en COP,
  // que es el lado barato del error (design §3).
  const tabla = tablaV6();
  const i = bisectarV6(tabla.inicio, ip.valor);
  if (i < 0 || ip.valor > tabla.fin[i]) return "desconocido";
  return "colombia";
}

/** `desconocido` también cuando el texto no es una dirección IP válida. */
export function origenDeIp(texto: string | null | undefined): Origen {
  if (!texto) return "desconocido";
  const ip = aNumero(texto);
  return ip === null ? "desconocido" : origenDeIpNumerica(ip);
}
