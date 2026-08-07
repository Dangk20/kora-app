// Qué partes del sitio NO son catálogo.
//
// Vive aquí y no dentro de `robots.ts` porque dos consumidores necesitan la
// misma lista: las reglas de rastreo, que las prohíben, y la prueba del
// sitemap, que comprueba que ninguna se coló. Escribirla dos veces sería la
// forma segura de que una ruta nueva entrara en una lista y no en la otra.

/**
 * Prefijos que un buscador no debe rastrear.
 *
 * No es una medida de seguridad —`robots.txt` es una petición, no un candado;
 * lo que protege `/admin` es el middleware— sino de higiene: son páginas sin
 * valor en resultados de búsqueda, y varias exponen estados personales
 * (el carrito de alguien, su cuenta, su enlace de baja).
 */
export const RUTAS_PRIVADAS = [
  "/admin", // panel completo
  "/login", // acceso del equipo
  "/cuenta", // cuenta del comprador e historial
  "/carrito",
  "/checkout",
  "/suscripcion", // enlaces firmados de baja
  "/media", // archivos servidos desde disco (solo desarrollo)
  "/api",
] as const;
