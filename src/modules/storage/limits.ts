// Límites de las imágenes. SIN dependencias, a propósito.
//
// Estos valores los necesitan las dos orillas: el servidor para validar y el
// NAVEGADOR para avisar antes de enviar. Importarlos desde el barril
// `@/modules/storage` arrastraba `local-driver.ts` —y con él `node:fs`— al
// paquete del cliente, y el build fallaba con "the chunking context does not
// support external modules".
//
// Por eso viven aquí: un archivo de constantes que puede importar cualquiera.

/** Formatos que aceptamos para foto de producto y banner. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Tamaño máximo del archivo que sube el operador.
 *
 * ⚠️ Debe ir por DEBAJO de `serverActions.bodySizeLimit` de `next.config.ts`:
 * Next corta el cuerpo en el borde, antes de que este límite se comprueba, y
 * el operador vería "Application error" sin ninguna pista. Fijado por
 * `tests/limites-subida.test.ts`.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGES_PER_PRODUCT = 8;
