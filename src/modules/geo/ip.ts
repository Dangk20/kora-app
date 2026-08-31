// La IP del visitante, tomada de forma que el visitante no pueda dictarla.
//
// Ver openspec/changes/deteccion-moneda-por-ip — design.md decisión 5.

export type IpNumerica =
  | { version: 4; valor: number }
  | { version: 6; valor: bigint };

/**
 * La IP en la que se puede confiar.
 *
 * `X-Forwarded-For` es una LISTA, y solo la última entrada la escribió nuestro
 * propio borde: las anteriores son texto que eligió el cliente. Por eso se lee
 * POR LA DERECHA. Leer la primera —el reflejo habitual, porque sin proxies
 * intermedios es la del cliente— convertiría la cabecera en un selector de
 * país que cualquiera puede accionar.
 *
 * El Caddyfile además sobrescribe la cabecera con la IP del par TCP, así que
 * en producción la lista tiene un solo elemento. Esto es la segunda capa: si
 * mañana se quita esa línea o se intercala otro proxy, seguimos sin dejarnos
 * dictar el origen.
 */
export function ipDeConfianza(cabeceras: Headers): string | null {
  const reenviada = cabeceras.get("x-forwarded-for");
  if (reenviada) {
    const entradas = reenviada.split(",").map((e) => e.trim()).filter(Boolean);
    const ultima = entradas[entradas.length - 1];
    if (ultima) return limpiar(ultima);
  }
  const real = cabeceras.get("x-real-ip");
  return real ? limpiar(real.trim()) : null;
}

/** Quita corchetes y puerto: `[::1]:443`, `1.2.3.4:56789`. */
function limpiar(valor: string): string {
  if (valor.startsWith("[")) {
    const cierre = valor.indexOf("]");
    return cierre > 0 ? valor.slice(1, cierre) : valor;
  }
  // Un solo `:` es IPv4 con puerto. Varios son una IPv6 sin corchetes, que
  // en ese formato no puede llevar puerto.
  const partes = valor.split(":");
  return partes.length === 2 ? partes[0] : valor;
}

const PREFIJO_V4_MAPEADA = 0xffffn; // ::ffff:0:0/96

/** `null` cuando el texto no es una dirección IP. Nunca lanza. */
export function aNumero(texto: string): IpNumerica | null {
  if (!texto) return null;
  if (!texto.includes(":")) {
    const valor = ipv4ANumero(texto);
    return valor === null ? null : { version: 4, valor };
  }
  const valor = ipv6ANumero(texto);
  if (valor === null) return null;
  // IPv4 envuelta en IPv6 (`::ffff:190.85.1.1`): es una IPv4, y hay que
  // buscarla en la tabla de IPv4, donde está, y no en la de IPv6.
  if (valor >> 32n === PREFIJO_V4_MAPEADA) {
    return { version: 4, valor: Number(valor & 0xffffffffn) };
  }
  return { version: 6, valor };
}

function ipv4ANumero(texto: string): number | null {
  const partes = texto.split(".");
  if (partes.length !== 4) return null;
  let valor = 0;
  for (const parte of partes) {
    if (!/^\d{1,3}$/.test(parte)) return null;
    const octeto = Number(parte);
    if (octeto > 255) return null;
    valor = valor * 256 + octeto;
  }
  return valor;
}

function ipv6ANumero(texto: string): bigint | null {
  let cuerpo = texto;

  // Cola escrita en notación IPv4 (`::ffff:1.2.3.4`): se traduce a dos grupos
  // hexadecimales antes que nada, para que el resto del parseo sea uniforme.
  if (cuerpo.includes(".")) {
    const corte = cuerpo.lastIndexOf(":");
    const v4 = ipv4ANumero(cuerpo.slice(corte + 1));
    if (v4 === null) return null;
    cuerpo = `${cuerpo.slice(0, corte + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const mitades = cuerpo.split("::");
  if (mitades.length > 2) return null;

  const cabeza = mitades[0] ? mitades[0].split(":") : [];
  const cola = mitades.length === 2 && mitades[1] ? mitades[1].split(":") : [];
  const faltan = 8 - cabeza.length - cola.length;
  if (mitades.length === 2 && faltan < 0) return null;

  const grupos =
    mitades.length === 2
      ? [...cabeza, ...new Array(faltan).fill("0"), ...cola]
      : cabeza;

  if (grupos.length !== 8) return null;
  if (grupos.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;

  let valor = 0n;
  for (const grupo of grupos) valor = (valor << 16n) + BigInt(parseInt(grupo, 16));
  return valor;
}

/** Rangos IPv4 que no identifican a nadie en internet, como [inicio, fin]. */
const V4_SIN_ORIGEN: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0/8 — "esta red"
  [0x0a000000, 0x0affffff], // 10/8 privada
  [0x64400000, 0x647fffff], // 100.64/10 CGNAT del operador
  [0x7f000000, 0x7fffffff], // 127/8 bucle local
  [0xa9fe0000, 0xa9feffff], // 169.254/16 enlace local
  [0xac100000, 0xac1fffff], // 172.16/12 privada
  [0xc0a80000, 0xc0a8ffff], // 192.168/16 privada
  [0xe0000000, 0xffffffff], // multicast y reservado
];

/**
 * ¿Es una dirección que no corresponde a un visitante en internet?
 *
 * Importa porque la comprobación de salud del contenedor, el propio borde y
 * el desarrollo local entran por aquí: si se buscaran en la tabla darían
 * "exterior" —no están asignadas a Colombia— y la tienda arrancaría en
 * dólares para todo el que llegue sin cabecera de reenvío.
 */
export function sinOrigenGeografico(ip: IpNumerica): boolean {
  if (ip.version === 4) {
    return V4_SIN_ORIGEN.some(([inicio, fin]) => ip.valor >= inicio && ip.valor <= fin);
  }
  if (ip.valor === 0n || ip.valor === 1n) return true; // :: y ::1
  const primeros8 = ip.valor >> 120n;
  if (primeros8 === 0xffn) return true; // ff00::/8 multicast
  const primeros7 = ip.valor >> 121n;
  if (primeros7 === 0x7en) return true; // fc00::/7 uso local
  const primeros10 = ip.valor >> 118n;
  if (primeros10 === 0x3fan) return true; // fe80::/10 enlace local
  return false;
}
