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
  // El gancho también se evalúa en el runtime edge (middleware), donde estas
  // comprobaciones no aplican y `process.exit` no existe.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Durante `next build` NODE_ENV ya es "production" pero las variables del
  // servidor todavía no existen: compilar no es servir, y abortar aquí haría
  // imposible construir la imagen sin credenciales de producción dentro.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertStorageConfigured } = await import("./modules/storage/config");

  try {
    assertStorageConfigured();
  } catch (error) {
    console.error(
      `\n✖ KORA no puede arrancar.\n  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    // `process.exit` y no relanzar: un throw aquí puede quedar atrapado por el
    // servidor y dejar el proceso vivo, que es exactamente lo que se corrige.
    process.exit(1);
  }
}
