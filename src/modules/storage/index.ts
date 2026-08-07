// Punto de entrada del almacenamiento: elige el driver por entorno y expone
// las utilidades de validación e identidad de archivos.
import { randomUUID } from "node:crypto";
import { assertStorageConfigured, configuredDriver } from "./config";
import type { StorageDriver } from "./driver";
import { LocalStorageDriver } from "./local-driver";
import { R2StorageDriver } from "./r2-driver";

export type { StorageDriver, StoredObject } from "./driver";
export { resolveUploadPath, uploadsRoot } from "./local-driver";
export {
  assertStorageConfigured,
  configuredDriver,
  missingR2Vars,
  R2_REQUIRED_VARS,
  STORAGE_DRIVERS,
  StorageConfigError,
  uploadsDir,
} from "./config";
export type { StorageDriverName } from "./config";

/** Formatos que aceptamos para foto de producto. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGES_PER_PRODUCT = 8;

let cached: StorageDriver | undefined;

/**
 * El driver que se ELIGIÓ, no el que se pueda montar con lo que haya.
 *
 * Antes esta función decía "si están todas las variables de R2, R2; si no,
 * disco". Ese respaldo automático era una trampa en producción: un error de
 * tecleo en una credencial de R2 no daba ningún error — las imágenes se
 * guardaban en el sistema de archivos del contenedor y el siguiente despliegue
 * las borraba todas. Ahora la elección es explícita y su configuración
 * incompleta tumba el arranque.
 *
 * La comprobación de verdad ocurre AL ARRANCAR (`src/instrumentation.ts`), no
 * aquí: para cuando alguien llama a esta función ya hay tráfico y el proceso no
 * debería estar vivo. El `assertStorageConfigured` de abajo es la segunda línea
 * de defensa, por si se invoca desde un contexto que no pasó por el arranque
 * del servidor (un script, una tarea programada, una prueba).
 */
export function storage(): StorageDriver {
  if (cached) return cached;

  assertStorageConfigured();

  // En desarrollo `configuredDriver()` devuelve "disk" cuando no se eligió;
  // en producción no llega aquí sin elección, porque la línea de arriba lanza.
  if (configuredDriver() === "r2") {
    cached = new R2StorageDriver({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
      publicUrl: process.env.R2_PUBLIC_URL!.replace(/\/$/, ""),
    });
  } else {
    cached = new LocalStorageDriver();
  }
  return cached;
}

/** Solo para tests: olvida el driver memoizado. */
export function resetStorage(): void {
  cached = undefined;
}

/**
 * Key nueva para cada subida: `productos/<productId>/<uuid>.<ext>`.
 * Nunca reutiliza el nombre original (evita colisiones, caracteres raros y
 * que el CDN sirva una imagen vieja cacheada).
 */
export function imageKey(productId: string, contentType: string): string {
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) throw new Error(`Tipo de imagen no permitido: ${contentType}`);
  return `productos/${productId}/${randomUUID()}.${ext}`;
}

/**
 * Verifica que los bytes sean realmente la imagen que dice el content-type.
 * Un cliente puede mentir en el tipo MIME; los magic numbers no.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return "image/png";
  }
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  // AVIF: caja "ftyp" con marca avif/avis.
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}
