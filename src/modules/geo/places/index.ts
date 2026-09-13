// Ciudades por división administrativa, para los dos países en que vende KORA.
// UNA definición: la usan el checkout y la libreta de direcciones de la cuenta.
//
// Los dos catálogos son OFICIALES y CERRADOS: Colombia, el DIVIPOLA del DANE
// (1.122 municipios); EE.UU., el Gazetteer del Census Bureau (~32.000 lugares,
// incluidos los CDP: donde vive gente aunque no tenga alcalde — Kendall o
// Brandon son CDP). Así la ciudad es un desplegable en los dos países, con
// un buscador porque California trae 1.600 entradas.
//
// Este módulo no importa nada de Next ni de la base: lo consumen componentes
// cliente.

import { US_STATES } from "@/modules/orders/geo";
import { MUNICIPIOS_CO } from "./co";
import { CITIES_US } from "./us";

export type PaisConCiudades = "CO" | "US";

/**
 * Las ciudades de una división. `state` es el nombre del departamento (CO)
 * o el nombre O el código del estado (US): los pedidos guardan "Florida",
 * la tabla va por "FL", y aquí se acepta cualquiera de los dos.
 */
export function ciudadesDe(country: PaisConCiudades, state: string): readonly string[] {
  if (!state) return [];
  if (country === "CO") return MUNICIPIOS_CO[state] ?? [];
  const code = US_STATES.find((s) => s.code === state || s.name === state)?.code ?? state;
  return CITIES_US[code] ?? [];
}

/**
 * Las dos listas son completas: el desplegable es cerrado en ambos países.
 * Se conserva la función (y no una constante) por si un tercer país entra
 * sin catálogo oficial.
 */
export function listaCerrada(country: PaisConCiudades): boolean {
  return country === "CO" || country === "US";
}

export { MUNICIPIOS_CO, CITIES_US };

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/**
 * ¿`city` es una ciudad válida de esa división? Sin distinguir mayúsculas ni
 * tildes ("NEIVA", "Bogota") y devolviendo el nombre canónico para guardarlo
 * bien. En EE.UU. la lista es abierta: cualquier texto vale, tal cual.
 */
export function ciudadCanonica(country: PaisConCiudades, state: string, city: string): string | null {
  const c = city.trim();
  if (!c) return null;
  if (!listaCerrada(country)) return c;
  const objetivo = normalizar(c);
  // "Saint" y "St." son la misma ciudad para quien la escribe; el Census
  // usa "St.".
  const alt = objetivo.replace(/^saint\s/, "st. ").replace(/^st\s/, "st. ");
  return ciudadesDe(country, state).find((x) => { const n = normalizar(x); return n === objetivo || n === alt; }) ?? null;
}
