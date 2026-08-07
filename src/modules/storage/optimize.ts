// Optimización de imágenes al subirlas.
//
// **Por qué existe.** Hasta el 7 ago, la foto que subía el operador era
// EXACTAMENTE la que descargaba el comprador: sin redimensionar y sin
// comprimir. Una foto de celular pesa entre 2 y 4 MB, el catálogo móvil
// enseña 12 productos por pantalla, y eso son ~40 MB para ver una página —
// con datos móviles, que es como va a comprar la mayoría. La tienda no
// cargaría, y el DoD de Lighthouse >90 en móvil sería inalcanzable.
//
// **Qué hace.** Reduce al lado mayor que se necesita, convierte a WebP y
// comprime. Una foto de 4 MB queda en 150–300 KB sin diferencia visible en
// pantalla.
//
// **Lo que NO hace, a propósito:**
// - No recorta. La proporción original se conserva: recortar una foto de
//   producto le quita producto, que es el defecto que se corrigió esta misma
//   mañana en diez pantallas.
// - No amplía. Una imagen ya pequeña se deja como está; estirarla solo añade
//   peso y la ve peor.
// - No toca los originales del cliente: se procesa lo que llega y se guarda el
//   resultado. El original no se conserva porque no se usa para nada y
//   duplicaría el respaldo.

import sharp from "sharp";

/** Lado mayor, en píxeles, según para qué es la imagen. */
export const LADO_MAXIMO = {
  // Ficha de producto: la galería llega a 480 px y el visitante puede tener
  // pantalla de doble densidad. 1600 deja margen para ampliar sin verse mal.
  producto: 1600,
  // Banners: ocupan el ancho del contenedor (1320 px) y también van a
  // pantallas densas.
  banner: 1920,
} as const;

export type UsoImagen = keyof typeof LADO_MAXIMO;

const CALIDAD_WEBP = 80;

export type ImagenOptimizada = {
  buffer: Buffer;
  /** Siempre `image/webp`: el formato de salida es uno. */
  contentType: string;
  ancho: number;
  alto: number;
  bytesOriginales: number;
};

/**
 * Deja la imagen lista para servir.
 *
 * Devuelve SIEMPRE WebP. Que la entrada sea JPG, PNG o AVIF da igual: guardar
 * un solo formato evita que la tienda dependa de qué exportó el diseñador, y
 * WebP lo entienden todos los navegadores que le importan a este negocio.
 */
export async function optimizarImagen(
  entrada: Buffer,
  uso: UsoImagen,
): Promise<ImagenOptimizada> {
  const lado = LADO_MAXIMO[uso];

  const pipeline = sharp(entrada, { failOn: "error" })
    // `rotate()` sin argumentos aplica la orientación EXIF y la elimina. Sin
    // esto, una foto tomada en vertical con el teléfono se guarda girada: el
    // navegador ya no lee EXIF al pintar un <img>, así que el operador la ve
    // bien al elegirla y torcida en la tienda.
    .rotate()
    .resize({
      width: lado,
      height: lado,
      fit: "inside",
      // No ampliar: una pieza de 600 px se queda en 600.
      withoutEnlargement: true,
    })
    .webp({ quality: CALIDAD_WEBP });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: "image/webp",
    ancho: info.width,
    alto: info.height,
    bytesOriginales: entrada.length,
  };
}
