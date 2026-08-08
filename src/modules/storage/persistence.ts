// ¿El almacenamiento de imágenes PERSISTE entre despliegues?
//
// Esta es la comprobación que protege el trabajo del cliente, y existe por un
// modo de fallo concreto: si `KORA_UPLOADS_DIR` no está montado sobre un
// volumen de Docker, vive dentro del contenedor. Se crea sin error, se escribe
// sin error, y DESAPARECE en cada `up -d --force-recreate`.
//
// El resultado sería una tienda que responde 200, con el catálogo completo y
// todas las fichas sin una sola foto — un catálogo que el cliente cargó a mano
// durante semanas. Ningún registro, ninguna excepción, ninguna alerta.
//
// Es el mismo defecto que ya se corrigió una vez en este proyecto —el
// contenedor que pasaba la verificación de salud con la tienda rota— entrando
// por otra puerta.
//
// La señal que lo delata: la base dice que hay N imágenes y el directorio
// tiene 0 archivos. Eso no admite otra lectura.
//
// Ver openspec/changes/imagenes-en-vps-con-cdn — design.md decisión 2.

import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configuredDriver, uploadsDir } from "./config";

export class StoragePersistenceError extends Error {
  constructor(
    readonly imagenesEnBase: number,
    readonly directorio: string,
  ) {
    super(
      `El almacenamiento de imágenes NO está persistiendo. La base registra ${imagenesEnBase} ` +
        `imagen(es) de producto y el directorio '${directorio}' no contiene ninguna.\n\n` +
        "  Causa casi segura: KORA_UPLOADS_DIR no está montado sobre un volumen, así que las\n" +
        "  imágenes viven dentro del contenedor y el último despliegue las borró.\n\n" +
        "  Arrancar así serviría la tienda entera sin fotos, sin que nada más fallara.\n" +
        "  Revisa el volumen en docker-compose y restaura las imágenes desde el respaldo.",
    );
    this.name = "StoragePersistenceError";
  }
}

export class StorageNotWritableError extends Error {
  constructor(
    readonly directorio: string,
    readonly causa: string,
  ) {
    super(
      `El directorio de imágenes '${directorio}' NO se puede escribir: ${causa}\n\n` +
        "  Causa casi segura: el volumen de Docker pertenece a root y la aplicación corre\n" +
        "  como 'node' (uid 1000). Docker crea los volúmenes con nombre como root salvo que\n" +
        "  el directorio exista en la imagen con otro dueño.\n\n" +
        "  Arreglo en un entorno ya montado:\n" +
        "    docker run --rm -v <pila>_uploads:/u alpine chown -R 1000:1000 /u\n\n" +
        "  Arrancar así serviría el panel entero y solo fallaría al subir la primera foto,\n" +
        "  con un error genérico en la cara del operador.",
    );
    this.name = "StorageNotWritableError";
  }
}

/** ¿Hay al menos un archivo dentro del directorio, a cualquier profundidad? */
async function tieneAlgunArchivo(dir: string): Promise<boolean> {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    // Que el directorio no exista cuenta como vacío: si además la base tiene
    // imágenes, es exactamente el caso que hay que denunciar.
    return false;
  }

  for (const e of entradas) {
    if (e.isFile()) return true;
    if (e.isDirectory() && (await tieneAlgunArchivo(join(dir, e.name)))) return true;
  }
  return false;
}

/**
 * Comprueba que se pueda ESCRIBIR donde van las imágenes.
 *
 * **Por qué hace falta además de la comprobación de persistencia.** Aquélla
 * mira si lo que la base registra sigue en el disco; no mira si el disco
 * admite escrituras. El 7 ago en pruebas el volumen quedó como root mientras
 * la aplicación corre como `node`: la tienda entera respondía 200, el panel
 * abría, y solo reventaba al crear el directorio de la primera foto —
 * `EACCES` con una pantalla genérica delante del operador.
 *
 * Es la misma lección que `sharp`: lo que va a fallar, que falle al arrancar y
 * no en la mano de quien está trabajando.
 *
 * Crea el directorio si no existe: en un entorno nuevo eso es legítimo, y es
 * justo la operación que fallaba.
 */
export async function assertStorageWritable(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.NODE_ENV !== "production") return;
  if (configuredDriver(env) !== "disk") return;

  const dir = uploadsDir(env);
  // Un nombre fijo y no aleatorio: si un arranque muere entre escribir y
  // borrar, el siguiente lo pisa en vez de dejar basura acumulada.
  const testigo = join(dir, ".kora-escritura");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(testigo, "");
  } catch (e) {
    throw new StorageNotWritableError(dir, e instanceof Error ? e.message : String(e));
  }

  // El borrado va aparte: si falla, escribir sí funciona y eso es lo que
  // importa — no hay motivo para no arrancar.
  await unlink(testigo).catch(() => {});
}

/**
 * Comprueba que lo que la base cree que existe, exista.
 *
 * Solo aplica en producción y solo con driver de disco: con almacenamiento
 * remoto no vive nada en el servidor, así que no hay nada que comprobar.
 *
 * `contarImagenes` se inyecta para que la comprobación no importe Prisma —
 * `src/instrumentation.ts` la carga en el arranque y arrastrar el cliente de
 * base de datos ahí encarecería el gancho sin necesidad.
 */
export async function assertStoragePersists(
  contarImagenes: () => Promise<number>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.NODE_ENV !== "production") return;
  if (configuredDriver(env) !== "disk") return;

  const total = await contarImagenes();
  // Instalación nueva: no hay nada registrado, así que no se ha perdido nada.
  if (total === 0) return;

  const dir = uploadsDir(env);
  if (await tieneAlgunArchivo(dir)) return;

  throw new StoragePersistenceError(total, dir);
}

/**
 * Comprobación de arranque: verifica y, si el almacenamiento no persiste,
 * TERMINA.
 *
 * Mismo criterio que el resto de guardas del arranque (ver `config.ts`): el
 * `process.exit` vive en este módulo y no en el gancho, que Next compila
 * también para el runtime edge.
 */
export async function assertStoragePersistsOrExit(
  contarImagenes: () => Promise<number>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    // El orden importa: si no se puede escribir, decirlo así. Un directorio no
    // escribible también se ve "vacío", y denunciarlo como pérdida de imágenes
    // mandaría a quien lo lea a buscar en el respaldo un problema de permisos.
    await assertStorageWritable(env);
    await assertStoragePersists(contarImagenes, env);
  } catch (error) {
    console.error(
      `\n✖ KORA no puede arrancar.\n  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
