// Driver de disco. En desarrollo escribe en `.uploads/` (ignorado por git); en
// producción, en el directorio de `KORA_UPLOADS_DIR`, que DEBE ser un volumen
// montado — si no, las imágenes viven en la capa efímera del contenedor y cada
// despliegue las borra todas. Esa es la razón de `persistence.ts`.
//
// Los archivos se sirven por `/media/<key>`, una ruta de Next que valida la
// clave antes de leer, con caché inmutable de un año para que el CDN pregunte
// una sola vez por imagen.
//
// Ver openspec/changes/imagenes-en-vps-con-cdn — design.md decisiones 3 y 4.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "./config";
import type { StorageDriver, StoredObject } from "./driver";

/**
 * Directorio de subidas del entorno actual.
 *
 * Es una función y no una constante a propósito: como constante se evaluaría al
 * importar el módulo, antes de que las pruebas puedan cambiar el entorno, y
 * quedaría fijada la ruta de desarrollo para todo el proceso.
 */
export function uploadsRoot(): string {
  return uploadsDir();
}

/**
 * Resuelve una clave a una ruta absoluta dentro del directorio de subidas.
 * Rechaza cualquier clave que intente escaparse (`..`, rutas absolutas): la
 * clave llega de la base y no debe poder leer fuera de la carpeta.
 */
export function resolveUploadPath(key: string, root: string = uploadsRoot()): string | null {
  if (!key || key.startsWith("/") || key.includes("\0")) return null;
  const full = path.resolve(root, key);
  const raiz = path.resolve(root);
  if (full !== raiz && !full.startsWith(raiz + path.sep)) return null;
  return full;
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  // El content-type no se usa en disco: lo deduce de la extensión quien sirve
  // el archivo (`/media/[...key]`). En R2 sí viaja como metadato del objeto.
  async put(key: string, body: Buffer): Promise<StoredObject> {
    const full = resolveUploadPath(key);
    if (!full) throw new Error(`Key inválida: ${key}`);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return { key, url: this.urlFor(key) };
  }

  async delete(key: string): Promise<void> {
    const full = resolveUploadPath(key);
    if (!full) return;
    await unlink(full).catch(() => {
      // Borrar algo que ya no está no es un error: el objetivo es que no exista.
    });
  }

  urlFor(key: string): string {
    return `/media/${key}`;
  }
}
