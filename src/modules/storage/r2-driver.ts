// Driver de Cloudflare R2 (API compatible con S3) para producción.
// Las imágenes se sirven por el dominio público del bucket / CDN, nunca
// desde el VPS (plan técnico §3).
//
// ⚠️ Sin verificar contra una cuenta real todavía: la cuenta de R2 está
// pendiente de crearse. Antes del go-live hay que subir y borrar una imagen
// de prueba en staging con credenciales reales.
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageDriver, StoredObject } from "./driver";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Dominio público del bucket o del CDN, sin barra final. */
  publicUrl: string;
};

export class R2StorageDriver implements StorageDriver {
  readonly name = "r2" as const;
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Inmutable: cada subida genera una key nueva, así que el CDN puede
        // cachear para siempre y no hay que invalidar nada al reemplazar.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: this.urlFor(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  urlFor(key: string): string {
    return `${this.config.publicUrl}/${key}`;
  }
}
