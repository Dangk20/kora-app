// Qué hace el middleware con una petición, según host y ruta. Pura: sin Next,
// para poder fijarla por prueba (`tests/centro-legal.test.ts`).
//
//  · En el SUBDOMINIO legal, `/es/terminos` se sirve desde la ruta interna
//    `/legal/es/terminos`. Todo lo demás también se reescribe bajo `/legal`,
//    así que `/catalogo` o `/admin` caen en el 404 del centro legal: el
//    subdominio nunca sirve la tienda ni el panel.
//  · En el host de la TIENDA, los enlaces antiguos `/legal/<slug>` (sin
//    idioma) redirigen con 301 al documento en español. Y si hay subdominio
//    configurado, cualquier `/legal/...` se va allá: un mismo documento vivo
//    bajo dos direcciones es lo que el subdominio vino a evitar.

import { LEGAL_SLUGS } from "./content/types";
import { esHostLegal, LEGAL_PREFIX, legalBase, legalUrl } from "./url";

export type DecisionLegal =
  | { tipo: "seguir" }
  | { tipo: "reescribir"; ruta: string }
  | { tipo: "redirigir"; destino: string };

/** Archivos estáticos (`/logo-kora.png`, `/marcas/visa.svg`, `/robots.txt`). */
function esArchivo(pathname: string): boolean {
  return pathname.startsWith("/_next/") || /\/[^/]+\.[a-z0-9]+$/i.test(pathname);
}

export function enrutarLegal(
  host: string | null | undefined,
  pathname: string,
  env: NodeJS.ProcessEnv = process.env,
): DecisionLegal {
  if (esHostLegal(host, env)) {
    if (esArchivo(pathname)) return { tipo: "seguir" };
    // Alguien escribió la ruta interna en el subdominio: se le quita el prefijo.
    if (pathname === LEGAL_PREFIX || pathname.startsWith(`${LEGAL_PREFIX}/`)) {
      return { tipo: "redirigir", destino: pathname.slice(LEGAL_PREFIX.length) || "/" };
    }
    return { tipo: "reescribir", ruta: pathname === "/" ? LEGAL_PREFIX : `${LEGAL_PREFIX}${pathname}` };
  }

  if (pathname !== LEGAL_PREFIX && !pathname.startsWith(`${LEGAL_PREFIX}/`)) return { tipo: "seguir" };

  const resto = pathname.slice(LEGAL_PREFIX.length).replace(/\/+$/, ""); // "/terminos", "/es/terminos", ""
  const [primero] = resto.split("/").filter(Boolean);

  // Formato antiguo, sin idioma: korashopp.com/legal/terminos.
  if (primero && (LEGAL_SLUGS as readonly string[]).includes(primero)) {
    return { tipo: "redirigir", destino: legalUrl("es", primero as (typeof LEGAL_SLUGS)[number], { env }) };
  }

  const base = legalBase(env);
  if (base) return { tipo: "redirigir", destino: `${base}${resto || "/"}` };

  return { tipo: "seguir" };
}
