// Sirve las imágenes de producto cuando viven en el disco del servidor.
//
// La condición para servir NO es el entorno sino el driver elegido: con
// almacenamiento remoto esta ruta responde 404 en cualquier entorno —la
// garantía original de que el servidor no sirve imágenes de producto—, y con
// disco sirve en cualquiera, incluido producción.
//
// Antes la condición era `NODE_ENV === "production" → 404`, que era correcta
// mientras producción significaba R2. Ya no.
//
// Ver openspec/changes/imagenes-en-vps-con-cdn — design.md decisión 4.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { configuredDriver, resolveUploadPath } from "@/modules/storage";

// El driver se lee por petición, no al construir: es lo que decide si esta
// ruta existe, y en producción se resuelve desde el entorno del contenedor.
export const dynamic = "force-dynamic";

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
  // Con almacenamiento remoto el servidor no sirve ni una imagen de producto.
  if (configuredDriver() !== "disk") {
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
      // Las claves son únicas e inmutables (uuid por subida), así que un objeto
      // nunca cambia de contenido. Esto es lo que hace que el CDN pregunte UNA
      // vez por imagen: sin ello, ponerlo delante no ahorraría nada.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
