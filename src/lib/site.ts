// La dirección pública de la tienda. UNA definición.
//
// La necesitan los enlaces dentro de los correos, el `robots.txt`, el sitemap y
// la metadata para compartir. Todos tienen que construir URL absolutas contra
// la misma base: si una apuntara a otro sitio, el enlace del correo llevaría a
// un dominio y el de la vista previa a otro, sin que nada fallara.
//
// Vivía en `src/modules/email/driver.ts`, que era su primer consumidor. Se
// movió aquí cuando apareció el segundo: el módulo de rastreo no debería
// importar el de correo para saber cuál es el dominio de la tienda.

/** Base pública de la tienda, sin barra final. */
export function storeUrl(env = process.env): string {
  return (env.NEXT_PUBLIC_STORE_URL?.trim() || "https://korashopp.com").replace(/\/+$/, "");
}
