// Driver de disco para desarrollo. Los archivos van a `.uploads/` (ignorado
// por git) y se sirven por `/media/<key>`, una ruta de Next que valida la key
// antes de leer. No se usa en producción: allá manda R2 + CDN.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject } from "./driver";

export const UPLOADS_DIR = path.join(process.cwd(), ".uploads");

/**
 * Resuelve una key a una ruta absoluta dentro de UPLOADS_DIR.
 * Rechaza cualquier key que intente escaparse (`..`, rutas absolutas):
 * la key llega de la base y no debe poder leer fuera de la carpeta.
 */
export function resolveUploadPath(key: string): string | null {
  if (!key || key.startsWith("/") || key.includes("\0")) return null;
  const full = path.resolve(UPLOADS_DIR, key);
  const root = path.resolve(UPLOADS_DIR);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
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
