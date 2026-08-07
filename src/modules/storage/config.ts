// Configuración del almacenamiento: una sola fuente de verdad sobre DÓNDE
// viven las imágenes de producto y si esa elección está completa.
//
// Por qué existe este archivo aparte: la comprobación se hacía dentro de
// `storage()`, que es perezosa — se evalúa la primera vez que alguien pide el
// driver. Eso significaba que en producción, sin almacenamiento configurado, la
// aplicación ARRANCABA bien, respondía el login, y solo devolvía 500 cuando un
// visitante abría una página con imágenes. Un contenedor así pasa cualquier
// verificación de salud mientras la tienda está rota, y el fallo lo descubre el
// primer cliente en vez del despliegue.
//
// Se llama desde `src/instrumentation.ts` al arrancar el servidor.
// Ver openspec/changes/vps-two-stack-deploy — design.md decisión 8, y
// openspec/changes/imagenes-en-vps-con-cdn — design.md decisiones 1 y 3.

import path from "node:path";

export const R2_REQUIRED_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

export type R2Var = (typeof R2_REQUIRED_VARS)[number];

/** Dónde viven las imágenes de producto. */
export type StorageDriverName = "disk" | "r2";

export const STORAGE_DRIVERS: readonly StorageDriverName[] = ["disk", "r2"];

/**
 * Driver elegido.
 *
 * En producción la variable es OBLIGATORIA y no hay valor por defecto; en
 * desarrollo, ausente significa disco.
 *
 * Devuelve `null` cuando en producción no se eligió, y lanza cuando el valor no
 * es ninguno de los dos. Son casos distintos y el mensaje de error también.
 */
export function configuredDriver(env: NodeJS.ProcessEnv = process.env): StorageDriverName | null {
  const bruto = env.KORA_STORAGE_DRIVER?.trim().toLowerCase();

  if (!bruto) return env.NODE_ENV === "production" ? null : "disk";

  if (!STORAGE_DRIVERS.includes(bruto as StorageDriverName)) {
    throw new StorageConfigError(
      `KORA_STORAGE_DRIVER tiene el valor '${bruto}', que no es válido. ` +
        `Valores admitidos: ${STORAGE_DRIVERS.join(", ")}.`,
    );
  }

  return bruto as StorageDriverName;
}

/** Directorio de subidas cuando el driver es disco. */
export function uploadsDir(env: NodeJS.ProcessEnv = process.env): string {
  const configurado = env.KORA_UPLOADS_DIR?.trim();
  if (configurado) return configurado;

  // Valor de desarrollo: junto al proyecto, ignorado por git. En producción
  // esta rama no se alcanza — `assertStorageConfigured` exige la variable.
  return path.join(process.cwd(), ".uploads");
}

/** Variables de R2 que faltan o están vacías. Vacío = configuración completa. */
export function missingR2Vars(env: NodeJS.ProcessEnv = process.env): R2Var[] {
  return R2_REQUIRED_VARS.filter((name) => !env[name]?.trim());
}

export class StorageConfigError extends Error {
  readonly missing: readonly string[];

  constructor(mensaje: string, missing: readonly string[] = []) {
    super(mensaje);
    this.name = "StorageConfigError";
    this.missing = missing;
  }
}

/**
 * Lanza si en producción el almacenamiento no está elegido o está incompleto.
 *
 * NO hay respaldo automático a disco cuando falta configuración de R2, y esa
 * ausencia es la decisión importante de este archivo.
 *
 * El comportamiento anterior —"si faltan variables de R2, usa disco"— parece
 * una comodidad y en producción es una trampa: un error de tecleo en
 * `R2_SECRET_ACCESS_KEY` no producía ningún error. La aplicación arrancaba, el
 * operador subía fotos, se guardaban en la capa efímera del contenedor, y el
 * siguiente despliegue las borraba todas. Nada en ninguna pantalla lo decía.
 *
 * En desarrollo no hace nada: ahí el driver de disco es el comportamiento
 * correcto y exigir configuración rompería a cualquiera que clone el repositorio.
 */
export function assertStorageConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const driver = configuredDriver(env);

  if (driver === null) {
    throw new StorageConfigError(
      "Almacenamiento de imágenes sin elegir. Define KORA_STORAGE_DRIVER=disk (las imágenes " +
        "viven en el disco del servidor, detrás del CDN) o KORA_STORAGE_DRIVER=r2 (almacenamiento " +
        "remoto). No hay valor por defecto en producción a propósito: elegir en silencio por ti " +
        "sería elegir mal sin avisar.",
      ["KORA_STORAGE_DRIVER"],
    );
  }

  if (driver === "r2") {
    const missing = missingR2Vars(env);
    if (missing.length > 0) {
      throw new StorageConfigError(
        `Almacenamiento remoto (R2) elegido pero incompleto. Faltan estas variables de entorno: ${missing.join(", ")}. ` +
          "NO se cae a disco: hacerlo guardaría las imágenes en el sistema de archivos del " +
          "contenedor, y el siguiente despliegue las borraría sin un solo error.",
        missing,
      );
    }
    return;
  }

  if (!env.KORA_UPLOADS_DIR?.trim()) {
    throw new StorageConfigError(
      "Almacenamiento en disco elegido pero falta KORA_UPLOADS_DIR. En producción la ruta se " +
        "declara explícitamente porque tiene que coincidir con el volumen montado: si apunta a " +
        "cualquier otro sitio, las imágenes viven en el contenedor y cada despliegue las borra.",
      ["KORA_UPLOADS_DIR"],
    );
  }
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
