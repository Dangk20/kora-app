// Sube las fotos del catálogo desde una carpeta por referencia.
//
//   pnpm photos:import <carpeta> [--simular] [--solo KHR-0004]
//
// Espera la estructura del Drive del cliente (12 sep 2026): una carpeta por
// referencia —"KHR - 0004", con o sin espacios— y dentro las fotos con el
// nombre que traigan. La referencia es el SKU de la variante; de ahí sale el
// producto.
//
// IDEMPOTENTE, porque el cliente irá añadiendo fotos a las mismas carpetas y
// esto se va a correr muchas veces: cada foto se identifica por la huella
// SHA-256 de su archivo original (`ProductImage.sourceHash`). La que ya está,
// se salta; la nueva, entra. Las copias con "(1)" que deja Drive al descargar
// son idénticas byte a byte y caen solas por la misma huella.
//
// Entra por el MISMO camino que el panel: tipo real por magic numbers,
// optimización a WebP, `storage().put`, tope de fotos por producto. No hay un
// segundo camino para meter imágenes.
//
// Orden: el archivo llamado "Principal" (con la extensión que sea, sin
// distinguir mayúsculas) va PRIMERO —es lo que acordó el cliente el 12 sep—
// y el resto por nombre. Si la principal llega en una pasada posterior a las
// demás, se mueve a la posición 0 igual: la portada del producto no depende
// del orden en que se corrió esto.

import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { db } from "../src/lib/db";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  imageKey,
  sniffImageType,
  storage,
} from "../src/modules/storage";
import { optimizarImagen } from "../src/modules/storage/optimize";

function referenciaDe(carpeta: string): string {
  return basename(carpeta).trim().toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
}

async function main() {
  const args = process.argv.slice(2);
  const raiz = args.find((a) => !a.startsWith("--"));
  const simular = args.includes("--simular");
  const solo = args.includes("--solo") ? args[args.indexOf("--solo") + 1]?.toUpperCase() : null;
  if (!raiz) { console.error("Uso: pnpm photos:import <carpeta> [--simular] [--solo REF]"); process.exit(1); }

  const entradas = (await readdir(raiz, { withFileTypes: true })).filter((e) => e.isDirectory());
  const totales = { carpetas: 0, sinProducto: 0, subidas: 0, yaEstaban: 0, saltadas: 0, vacias: 0 };
  const avisos: string[] = [];
  const driver = storage();

  for (const e of entradas.sort((a, b) => a.name.localeCompare(b.name))) {
    const ref = referenciaDe(e.name);
    if (solo && ref !== solo) continue;
    totales.carpetas += 1;

    const variante = await db.variant.findFirst({
      where: { sku: { equals: ref, mode: "insensitive" } },
      select: { productId: true, product: { select: { name: true } } },
    });
    if (!variante) { totales.sinProducto += 1; avisos.push(`${ref}: no hay producto con ese SKU — importa primero el Excel.`); continue; }

    const esPrincipal = (f: string) => /^principal\./i.test(f);
    const archivos = (await readdir(join(raiz, e.name)))
      .filter((f) => !f.startsWith(".") && /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort((a, b) => Number(esPrincipal(b)) - Number(esPrincipal(a)) || a.localeCompare(b));
    let huellaPrincipal: string | null = null;
    if (archivos.length === 0) { totales.vacias += 1; avisos.push(`${ref}: carpeta sin fotos.`); continue; }

    const existentes = await db.productImage.findMany({
      where: { productId: variante.productId },
      select: { sourceHash: true, position: true },
    });
    const huellas = new Set(existentes.map((i) => i.sourceHash).filter(Boolean));
    let posicion = existentes.reduce((m, i) => Math.max(m, i.position + 1), 0);
    let cuenta = existentes.length;

    for (const f of archivos) {
      const ruta = join(raiz, e.name, f);
      const tam = (await stat(ruta)).size;
      if (tam > MAX_IMAGE_BYTES) { totales.saltadas += 1; avisos.push(`${ref}/${f}: pesa ${(tam / 1e6).toFixed(1)} MB (> 5 MB) — saltada.`); continue; }
      const bytes = await readFile(ruta);
      const huella = createHash("sha256").update(bytes).digest("hex");
      if (esPrincipal(f)) huellaPrincipal = huella;
      if (huellas.has(huella)) { totales.yaEstaban += 1; continue; }

      const tipo = sniffImageType(bytes);
      if (!tipo || !ALLOWED_IMAGE_TYPES[tipo]) { totales.saltadas += 1; avisos.push(`${ref}/${f}: no es una imagen válida — saltada.`); continue; }
      if (cuenta >= MAX_IMAGES_PER_PRODUCT) { totales.saltadas += 1; avisos.push(`${ref}/${f}: el producto ya tiene ${MAX_IMAGES_PER_PRODUCT} fotos (tope) — saltada.`); continue; }

      if (simular) { totales.subidas += 1; cuenta += 1; huellas.add(huella); continue; }

      const optimizada = await optimizarImagen(bytes, "producto");
      const key = imageKey(variante.productId, optimizada.contentType);
      await driver.put(key, optimizada.buffer, optimizada.contentType);
      await db.productImage.create({
        data: { productId: variante.productId, url: key, alt: variante.product.name, position: posicion++, sourceHash: huella },
      });
      huellas.add(huella);
      cuenta += 1;
      totales.subidas += 1;
    }
    // La principal a la posición 0, aunque haya entrado después que las demás.
    if (huellaPrincipal && !simular) {
      const principal = await db.productImage.findFirst({
        where: { productId: variante.productId, sourceHash: huellaPrincipal },
        select: { id: true, position: true },
      });
      if (principal && principal.position !== 0) {
        await db.$transaction([
          db.productImage.updateMany({
            where: { productId: variante.productId, position: { lt: principal.position } },
            data: { position: { increment: 1 } },
          }),
          db.productImage.update({ where: { id: principal.id }, data: { position: 0 } }),
        ]);
      }
    }
    process.stdout.write(`  ${ref}: ${archivos.length} archivo(s) → ${cuenta} foto(s) en "${variante.product.name}"${huellaPrincipal ? " · principal ✓" : " · SIN principal"}\n`);
  }

  console.log(`\n${simular ? "(simulación) " : ""}Carpetas: ${totales.carpetas} · subidas: ${totales.subidas} · ya estaban: ${totales.yaEstaban} · saltadas: ${totales.saltadas} · sin producto: ${totales.sinProducto} · vacías: ${totales.vacias}`);
  for (const a of avisos) console.log(`  ⚠ ${a}`);
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
