// Optimización de imágenes al subir.
//
// Hasta el 7 ago la foto que subía el operador era la que descargaba el
// comprador. Una de celular pesa 2–4 MB, el catálogo móvil enseña 12 por
// pantalla, y eso son ~40 MB para ver una página con datos móviles.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { LADO_MAXIMO, optimizarImagen } from "@/modules/storage/optimize";
import { imageKey } from "@/modules/storage";
import { ALLOWED_IMAGE_TYPES } from "@/modules/storage/limits";

/**
 * Una foto sintética con ruido, para que comprimir cueste de verdad.
 *
 * El ruido se genera PEQUEÑO y se amplía con `nearest`: llenar 12 millones de
 * píxeles en JavaScript tarda más que la propia prueba. Con `nearest` el ruido
 * sobrevive al ampliado —una interpolación suave lo convertiría en un degradado
 * que WebP comprime a nada, y la prueba del peso pasaría sin significar nada.
 */
async function foto(ancho: number, alto: number): Promise<Buffer> {
  const lado = 200;
  const px = lado * lado * 3;
  const datos = Buffer.alloc(px);
  for (let i = 0; i < px; i++) datos[i] = (i * 7919) % 256;

  return sharp(datos, { raw: { width: lado, height: lado, channels: 3 } })
    .resize(ancho, alto, { kernel: "nearest", fit: "fill" })
    .jpeg({ quality: 100 })
    .toBuffer();
}

// Procesar imágenes de varios megapíxeles no entra en los 5 s por omisión.
describe("optimización de imágenes", { timeout: 30_000 }, () => {
  it("reduce el lado mayor al máximo del uso", async () => {
    const r = await optimizarImagen(await foto(4000, 3000), "producto");

    expect(Math.max(r.ancho, r.alto)).toBe(LADO_MAXIMO.producto);
  });

  it("conserva la proporción: no recorta el producto", async () => {
    // Recortar una foto de producto le quita producto — el defecto que se
    // corrigió esta misma mañana en diez pantallas.
    const r = await optimizarImagen(await foto(4000, 2000), "producto");

    expect(r.ancho / r.alto).toBeCloseTo(2, 2);
  });

  it("NO amplía una imagen ya pequeña", async () => {
    // Estirarla solo añade peso y se ve peor.
    const r = await optimizarImagen(await foto(600, 400), "producto");

    expect(r.ancho).toBe(600);
    expect(r.alto).toBe(400);
  });

  it("los banners admiten más lado que las fotos de producto", async () => {
    // Un banner ocupa el ancho del contenedor; una foto de producto, media
    // tarjeta.
    expect(LADO_MAXIMO.banner).toBeGreaterThan(LADO_MAXIMO.producto);

    const r = await optimizarImagen(await foto(4000, 2000), "banner");
    expect(r.ancho).toBe(LADO_MAXIMO.banner);
  });

  it("siempre sale WebP, entre lo que entre", async () => {
    // Guardar un solo formato evita que la tienda dependa de qué exportó el
    // diseñador.
    const desdePng = await sharp(await foto(800, 600)).png().toBuffer();
    const r = await optimizarImagen(desdePng, "producto");

    expect(r.contentType).toBe("image/webp");
    // Firma de WebP: "RIFF" .... "WEBP"
    expect(r.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(r.buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("pesa MUCHO menos que el original — que es todo el motivo", async () => {
    const original = await foto(3000, 2000);
    const r = await optimizarImagen(original, "producto");

    expect(r.bytesOriginales).toBe(original.length);
    // Sin un mínimo real, la prueba pasaría con una reducción del 1 %.
    expect(r.buffer.length).toBeLessThan(original.length * 0.5);
  });

  it("una foto vertical de celular no acaba tumbada", async () => {
    // El navegador ya no lee la orientación EXIF al pintar un <img>: sin
    // aplicarla al procesar, el operador la ve bien al elegirla y torcida en
    // la tienda.
    //
    // Los píxeles van en HORIZONTAL y la orientación 6 dice "gírala 90° al
    // mostrarla" — que es exactamente lo que hace un celular al fotografiar en
    // vertical. Aplicada, el resultado tiene que quedar vertical.
    const delCelular = await sharp(await foto(3000, 2000))
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const r = await optimizarImagen(delCelular, "producto");
    expect(r.alto).toBeGreaterThan(r.ancho);
  });

  it("la clave del archivo acepta el tipo que produce el optimizador", async () => {
    // La costura entre optimizar y guardar: `imageKey` deduce la extensión del
    // content-type. Si el optimizador devolviera un tipo que esa tabla no
    // conoce, la subida fallaría en producción y no aquí.
    const r = await optimizarImagen(await foto(800, 600), "producto");

    expect(ALLOWED_IMAGE_TYPES[r.contentType]).toBe("webp");
    expect(imageKey("p1", r.contentType)).toMatch(/^productos\/p1\/[0-9a-f-]+\.webp$/);
  });

  it("un archivo que no es imagen falla, no se guarda basura", async () => {
    await expect(optimizarImagen(Buffer.from("esto no es una imagen"), "producto")).rejects.toThrow();
  });
});
