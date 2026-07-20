// Punto de entrada del almacenamiento: elige el driver por entorno y expone
// las utilidades de validación e identidad de archivos.
import { randomUUID } from "node:crypto";
import type { StorageDriver } from "./driver";
import { LocalStorageDriver } from "./local-driver";
import { R2StorageDriver } from "./r2-driver";

export type { StorageDriver, StoredObject } from "./driver";
export { resolveUploadPath, UPLOADS_DIR } from "./local-driver";

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
 * R2 si están todas sus variables; disco local en cualquier otro caso.
 * Configuración incompleta en producción es un error explícito: preferimos
 * fallar al arrancar antes que servir imágenes desde el VPS sin darnos cuenta.
 */
export function storage(): StorageDriver {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (accountId && accessKeyId && secretAccessKey && bucket && publicUrl) {
    cached = new R2StorageDriver({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicUrl: publicUrl.replace(/\/$/, ""),
    });
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Falta configurar R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL). En producción las imágenes no se sirven desde el VPS.",
      );
    }
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
