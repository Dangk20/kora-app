// Gancho de arranque de Next.js: corre UNA vez cuando el servidor levanta,
// antes de atender la primera petición.
//
// Aquí viven las comprobaciones que deben tumbar el arranque en vez de fallar
// más tarde. La regla: un contenedor en ejecución significa un entorno capaz de
// servir. Si algo esencial falta, es preferible que el despliegue se ponga rojo
// —con la versión anterior todavía sirviendo— a promover un proceso que se
// reporta sano y devuelve errores al primer cliente.
//
// Ver openspec/changes/vps-two-stack-deploy — design.md decisión 8.

export async function register(): Promise<void> {
  // El gancho también se compila para el runtime edge (middleware), donde estas
  // comprobaciones no aplican. La verificación y su `process.exit` viven en un
  // módulo aparte que solo se carga desde aquí, para que nada de Node entre en
  // el paquete edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Durante `next build` NODE_ENV ya es "production" pero las variables del
  // servidor todavía no existen: compilar no es servir, y abortar aquí haría
  // imposible construir la imagen sin credenciales de producción dentro.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertStorageConfiguredOrExit } = await import("./modules/storage/config");
  assertStorageConfiguredOrExit();

  // Mismo criterio para el correo: sin proveedor, en producción el módulo de
  // campañas está roto y el contenedor no debería reportarse sano. El fallo
  // aparecería si no cuando alguien lanza la primera campaña — delante del
  // cliente.
  const { assertEmailConfiguredOrExit } = await import("./modules/email/config");
  assertEmailConfiguredOrExit();

  // Y para los datos del comerciante: las páginas legales identifican a quién
  // se le entregan los datos personales. Sin ellos, el checkout pide una
  // autorización que no dice a favor de quién — un consentimiento que no
  // acredita nada. Es un fallo que no da error en ninguna pantalla.
  const { assertLegalConfiguredOrExit } = await import("./modules/legal/config");
  assertLegalConfiguredOrExit();
}
