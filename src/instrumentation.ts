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

  // Las tres guardas de configuración, comprobadas JUNTAS y con un solo
  // informe. Antes se llamaban en fila y cada una terminaba el proceso por su
  // cuenta, así que el contenedor delataba solo la primera: quien lo leyera
  // conseguía ese insumo, volvía a desplegar y descubría el siguiente. Con
  // variables que hay que pedirle al cliente, eso convierte un correo en
  // cuatro. Ver src/lib/startup-guards.ts.
  //
  // Qué cubren: que las imágenes de producto tengan dónde vivir; que el correo
  // tenga proveedor —sin él, en producción, el fallo aparecería cuando alguien
  // lanza la primera campaña, delante del cliente—; y que los datos del
  // comerciante existan, porque las páginas legales identifican a quién se le
  // entregan los datos personales y sin ellos el checkout pide una autorización
  // que no dice a favor de quién. Ninguno de los tres da error en pantalla.
  const { assertConfiguracionDeArranqueOrExit } = await import("./lib/startup-guards");
  assertConfiguracionDeArranqueOrExit();

  // Y la más silenciosa de todas: que las imágenes que la base cree que
  // existen, existan. Sin volumen montado viven en el contenedor y el último
  // despliegue se las llevó — la tienda respondería 200 con el catálogo
  // completo y todas las fichas sin foto, que es un catálogo que el cliente
  // cargó a mano. Va la última porque es la única que consulta la base.
  const { assertStoragePersistsOrExit } = await import("./modules/storage/persistence");
  const { db } = await import("./lib/db");
  await assertStoragePersistsOrExit(() => db.productImage.count());
}
