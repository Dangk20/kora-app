// Anuncio de la gran apertura de la tienda física (change `modal-gran-apertura`).
// Caduca solo: después del último día ya no se muestra, sin desplegar.

/** Último instante en que se muestra: fin del sábado 7 nov 2026, hora de Colombia (UTC−5). */
export const ANUNCIO_HASTA = Date.parse("2026-11-08T05:00:00Z");

/** Clave en `localStorage`: con valor, el visitante ya lo vio y lo cerró. */
export const ANUNCIO_CLAVE = "kora_anuncio_apertura_2026";

export const DIRECCION_TIENDA = "Calle 25 Sur # 32-23, Neiva, Huila, Colombia";
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DIRECCION_TIENDA)}`;

/** ¿Se debe mostrar ahora? Pura, para poder probarla sin navegador. */
export function anuncioVigente(ahora: number, yaVisto: boolean): boolean {
  return !yaVisto && ahora < ANUNCIO_HASTA;
}
