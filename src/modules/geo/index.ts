// ¿De dónde entra este visitante?
//
// La ÚNICA definición de esa pregunta en el sistema. Nadie más lee cabeceras
// de geolocalización ni la tabla de IPs: se pregunta aquí. Hoy la usa la
// moneda de la tienda (TIE_HU001 §1); mañana podría usarla cualquier otra cosa.
//
// No importa `next/headers` a propósito, igual que la sesión del comprador:
// recibe las cabeceras y así se puede probar y usar fuera de una petición.
// El envoltorio que las lee vive en `request.ts`.
//
// Ver openspec/changes/deteccion-moneda-por-ip — specs/visitor-geolocation.

import { ipDeConfianza } from "./ip";
import { origenDeIp, type Origen } from "./lookup";

export type { Origen } from "./lookup";
export { INSTANTANEA } from "./tabla";

/**
 * Cabeceras de país que ponen los CDN y proxies más comunes.
 *
 * Van PRIMERO porque su dato es mejor que el nuestro: se actualiza solo y
 * cubre IPv6 entero. Hoy no llega ninguna —`korashopp.com` resuelve directo
 * al VPS, sin nada delante— y por eso existe la tabla local; el día que haya
 * un CDN delante, toma el mando sin tocar código.
 */
const CABECERAS_DE_PAIS = [
  "cf-ipcountry", // Cloudflare
  "x-vercel-ip-country",
  "x-geo-country",
];

/**
 * Valores que una cabecera de país trae cuando el CDN NO sabe ubicar al
 * visitante. Tratarlos como país daría "exterior" para todo el que Cloudflare
 * no reconoce —el error caro— y llegando desde la fuente que se suponía más
 * fiable. Se descartan y la resolución sigue por la tabla.
 */
const NO_ES_UN_PAIS = new Set(["XX", "T1"]);

function origenDePais(codigo: string): Origen | null {
  const limpio = codigo.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(limpio) || NO_ES_UN_PAIS.has(limpio)) return null;
  return limpio === "CO" ? "colombia" : "exterior";
}

/**
 * Precedencia: cabecera de CDN → tabla local sobre la IP → `desconocido`.
 *
 * Una fuente que responde "no sé" NO corta la cadena: cede el turno a la
 * siguiente.
 */
export function origenDesdeCabeceras(cabeceras: Headers): Origen {
  for (const nombre of CABECERAS_DE_PAIS) {
    const valor = cabeceras.get(nombre);
    if (!valor) continue;
    const origen = origenDePais(valor);
    if (origen) return origen;
  }
  return origenDeIp(ipDeConfianza(cabeceras));
}
