// Abstracción de almacenamiento de archivos.
//
// El resto del sistema NUNCA sabe dónde viven los bytes: pide `put`/`delete`
// y recibe una key. En desarrollo los archivos van a disco (`.uploads/`), en
// producción a Cloudflare R2 detrás del CDN — el VPS jamás sirve imágenes
// (plan técnico §3). Cambiar de driver es una variable de entorno, no un
// refactor: por eso la cuenta de R2 puede llegar después sin frenar S3.

export type StoredObject = {
  /** Ruta lógica dentro del bucket. Es lo que se guarda en la base. */
  key: string;
  /** URL pública para <img src>. */
  url: string;
};

export interface StorageDriver {
  readonly name: "local" | "r2";
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  /** URL pública de una key ya almacenada. */
  urlFor(key: string): string;
}
