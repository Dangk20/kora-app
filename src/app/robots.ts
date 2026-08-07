import type { MetadataRoute } from "next";
import { esProduccion } from "@/lib/environment";
import { storeUrl } from "@/lib/site";
import { RUTAS_PRIVADAS } from "@/modules/legal/routes";

// Reglas de rastreo.
//
// Segunda capa, no la única: el borde ya añade `X-Robots-Tag: noindex` al
// entorno de pruebas (deploy/Caddyfile) y ese entorno está además tras
// autenticación básica. Se duplica a propósito — un cambio de configuración
// del proxy no debería bastar para que Google indexe datos de demostración.

// Se resuelve al pedirlo, no al construir la imagen.
//
// Sin esto Next lo prerrenderiza: durante `next build` NODE_ENV ya es
// "production" y `KORA_ENV` todavía no existe (el Dockerfile no la pasa al
// builder, ver deploy/README.md), así que el archivo quedaría congelado en
// "permitir todo" — y ESA MISMA IMAGEN es la que corre en pruebas. El entorno
// de pruebas serviría un robots.txt que invita a rastrearlo, y esta capa, que
// existe justamente para no depender solo de la cabecera del borde, no
// protegería de nada.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = storeUrl();

  // Cualquier entorno que no sea producción real: nada se rastrea.
  // `esProduccion()` es el mismo predicado que decide si el correo sale de
  // verdad (src/lib/environment.ts) — una sola definición de "producción".
  if (!esProduccion()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: RUTAS_PRIVADAS.map((ruta) => `${ruta}/`),
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
