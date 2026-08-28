// ¿Se puede ESCRIBIR donde el driver de disco deja los correos?
//
// Existe por un fallo que estuvo tres semanas activo sin que nadie lo viera.
// El volumen `kora-staging_correos` nació de root —Docker inicializa un volumen
// con nombre copiando el directorio de la imagen CON SU DUEÑO, y `/emails` no
// existía en la imagen— mientras el worker corre como `node`. Resultado: desde
// el 7 hasta el 28 de agosto de 2026, **cada correo de pruebas falló con
// EACCES** y ninguno llegó a escribirse.
//
// Lo que hace grave un fallo así no es su tamaño, es su forma. El entorno se
// veía sano: el worker arriba, los eventos consumiéndose, la tienda vendiendo.
// El síntoma quedaba en `outbox:status` —9 eventos muertos— que hay que ir a
// mirar. Y el directorio existe justamente para lo contrario: para que el
// cliente pueda LEER y aprobar los siete correos antes de que el dominio pueda
// enviarlos de verdad.
//
// Es la misma comprobación que ya protegía las imágenes de producto, aplicada
// donde faltaba. La lección general: **si un directorio montado importa, hay
// que escribir en él al arrancar.** Comprobar que existe no basta; un directorio
// de root también existe.

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emailDevDir, usaDriverDeDisco } from "./file-target";

export class EmailDirNotWritableError extends Error {
  constructor(
    readonly directorio: string,
    readonly causa: string,
  ) {
    super(
      `El directorio de correos '${directorio}' NO se puede escribir: ${causa}\n\n` +
        "  Causa casi segura: el volumen de Docker pertenece a root y el worker corre\n" +
        "  como 'node' (uid 1000). Docker crea los volúmenes con nombre como root salvo\n" +
        "  que el directorio exista en la imagen con otro dueño.\n\n" +
        "  Arreglo en un entorno ya montado:\n" +
        "    docker run --rm -v <pila>_correos:/e alpine chown -R 1000:1000 /e\n\n" +
        "  Arrancar así deja el entorno con aspecto sano y NINGÚN correo escrito: el\n" +
        "  fallo solo aparece en `pnpm outbox:status`, donde hay que ir a mirarlo.",
    );
    this.name = "EmailDirNotWritableError";
  }
}

/**
 * Comprueba que el destino de los correos en disco se pueda escribir.
 *
 * Solo aplica cuando ese driver está en uso —es decir, en PRUEBAS—: en
 * producción el correo sale por el proveedor y no hay directorio que comprobar,
 * y en desarrollo se escribe en `.emails/` del propio proyecto, donde el
 * problema de dueños no existe.
 */
export async function assertEmailDirWritable(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!usaDriverDeDisco(env)) return;

  const dir = emailDevDir(env);
  // Nombre fijo y no aleatorio: si un arranque muere entre escribir y borrar,
  // el siguiente lo pisa en vez de dejar basura acumulada.
  const testigo = join(dir, ".kora-escritura");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(testigo, "");
  } catch (e) {
    throw new EmailDirNotWritableError(dir, e instanceof Error ? e.message : String(e));
  }

  // El borrado va aparte: si falla, escribir sí funciona, que es lo que importa.
  await unlink(testigo).catch(() => {});
}
