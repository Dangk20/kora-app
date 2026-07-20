// Sirve las imágenes del driver local SOLO en desarrollo. En producción las
// imágenes viven en R2 detrás del CDN y esta ruta no se usa (responde 404):
// el VPS nunca sirve archivos estáticos de producto.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolveUploadPath } from "@/modules/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new Response("No encontrado", { status: 404 });
  }

  const { key } = await params;
  const full = resolveUploadPath(key.join("/"));
  if (!full) return new Response("Ruta inválida", { status: 400 });

  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) return new Response("No encontrado", { status: 404 });

  const ext = full.split(".").pop()?.toLowerCase() ?? "";
  const stream = Readable.toWeb(
    createReadStream(full),
  ) as unknown as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(info.size),
      // Las keys son únicas e inmutables (uuid por subida).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
