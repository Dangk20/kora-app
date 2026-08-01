// Configuración del almacenamiento: una sola fuente de verdad sobre qué
// variables hacen falta y si están.
//
// Por qué existe este archivo aparte: la comprobación se hacía dentro de
// `storage()`, que es perezosa — se evalúa la primera vez que alguien pide el
// driver. Eso significaba que en producción, sin R2 configurado, la aplicación
// ARRANCABA bien, respondía el login, y solo devolvía 500 cuando un visitante
// abría una página con imágenes. Un contenedor así pasa cualquier verificación
// de salud mientras la tienda está rota, y el fallo lo descubre el primer
// cliente en vez del despliegue.
//
// Se llama desde `src/instrumentation.ts` al arrancar el servidor.
// Ver openspec/changes/vps-two-stack-deploy — design.md decisión 8.

export const R2_REQUIRED_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

export type R2Var = (typeof R2_REQUIRED_VARS)[number];

/** Variables de R2 que faltan o están vacías. Vacío = configuración completa. */
export function missingR2Vars(env: NodeJS.ProcessEnv = process.env): R2Var[] {
  return R2_REQUIRED_VARS.filter((name) => !env[name]?.trim());
}

export class StorageConfigError extends Error {
  readonly missing: readonly R2Var[];

  constructor(missing: readonly R2Var[]) {
    super(
      `Almacenamiento de imágenes sin configurar. Faltan estas variables de entorno: ${missing.join(", ")}. ` +
        "En producción las imágenes se sirven desde Cloudflare R2, nunca desde el VPS (plan técnico §3).",
    );
    this.name = "StorageConfigError";
    this.missing = missing;
  }
}

/**
 * Lanza si en producción falta configuración del almacenamiento remoto.
 *
 * En desarrollo no hace nada: ahí el driver de disco (`.uploads/`) es el
 * comportamiento correcto y exigir credenciales de R2 rompería a cualquiera
 * que clone el repositorio.
 */
export function assertStorageConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const missing = missingR2Vars(env);
  if (missing.length > 0) throw new StorageConfigError(missing);
}

/**
 * Comprobación de arranque: verifica y, si falta configuración, TERMINA.
 *
 * El `process.exit` vive aquí y no en `src/instrumentation.ts` porque Next
 * compila ese archivo **también para el runtime edge**, donde `process.exit` no
 * existe — y el empaquetador lo señala como error aunque haya una guarda en
 * tiempo de ejecución. Este módulo solo se carga mediante importación dinámica
 * desde el runtime de Node, así que nunca entra en el paquete edge.
 *
 * Se usa `process.exit` y no `throw` porque un throw en el gancho de arranque
 * puede quedar atrapado por el servidor y dejar el proceso vivo — que es
 * exactamente el defecto que esta guarda corrige.
 */
export function assertStorageConfiguredOrExit(env: NodeJS.ProcessEnv = process.env): void {
  try {
    assertStorageConfigured(env);
  } catch (error) {
    console.error(
      `\n✖ KORA no puede arrancar.\n  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
