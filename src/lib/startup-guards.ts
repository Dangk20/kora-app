// Las guardas de configuración de arranque, comprobadas TODAS antes de rendirse.
//
// Por qué existe este archivo. Hasta el 27 ago 2026, `instrumentation.ts`
// llamaba a las tres comprobaciones en fila y cada una terminaba el proceso por
// su cuenta. El efecto solo se ve el día que se estrena un entorno: al levantar
// producción por primera vez, el contenedor dijo exactamente
//
//     Envío de correo sin configurar. Faltan estas variables: RESEND_API_KEY.
//
// y ni una palabra sobre las CUATRO variables de datos del comerciante que
// también faltaban. Quien lo lea consigue la clave del proveedor, vuelve a
// desplegar —ocho o diez minutos— y entonces descubre la siguiente. Un
// descubrimiento en serie de una lista que el proceso ya conocía entera.
//
// Importa más de lo que parece porque esas variables no son nuestras: son
// insumos que hay que pedirle al cliente. Pedirlos de uno en uno, con un
// despliegue entre medias, convierte un correo en cuatro.
//
// Lo que va aquí es lo que vale para CUALQUIER proceso: configuración, no
// recursos. Que el destino de los correos en disco se pueda escribir NO está
// aquí, y esa distinción se pagó: al ponerlo, el despliegue a pruebas se cayó.
// La aplicación no tiene montado `/emails` —ni tiene por qué: no envía, que es
// una regla del proyecto con prueba propia— pero sí recibe `EMAIL_DEV_DIR` por
// el `env_file` compartido, así que exigirle escribir ahí la mataba. Esa
// comprobación vive en `modules/email/writable.ts` y la llama solo el worker.
//
// Las comprobaciones que dependen de la BASE no van aquí: se ejecutan después,
// y solo si la configuración ya está completa. Preguntarle a la base antes de
// saber si el entorno es coherente añade un modo de fallo (base caída) a un
// diagnóstico que trata de otra cosa.
//
// El `process.exit` vive en este módulo y no en `instrumentation.ts` por la
// misma razón que en los módulos de origen: Next compila ese archivo TAMBIÉN
// para el runtime edge, donde `process.exit` no existe, y el empaquetador lo
// señala como error aunque haya una guarda en tiempo de ejecución. Aquí se
// llega solo por importación dinámica desde el runtime de Node.

import { assertEmailConfigured } from "@/modules/email/config";
import { assertLegalConfigured } from "@/modules/legal/config";
import { assertStorageConfigured } from "@/modules/storage/config";

type Guarda = {
  /** Qué se está comprobando, para poder nombrarlo en el informe. */
  asunto: string;
  comprobar: (env: NodeJS.ProcessEnv) => void;
};

/**
 * El orden es el del informe, no el de importancia: se ejecutan todas.
 *
 * Almacenamiento primero porque es la única que no depende de un insumo del
 * cliente — si falla, es un error nuestro de configuración y conviene leerlo
 * antes que la lista de lo que hay que pedir fuera.
 */
const GUARDAS: readonly Guarda[] = [
  { asunto: "Imágenes de producto", comprobar: assertStorageConfigured },
  { asunto: "Envío de correo", comprobar: assertEmailConfigured },
  { asunto: "Datos del comerciante", comprobar: assertLegalConfigured },
];

export type FalloDeArranque = { asunto: string; mensaje: string };

/**
 * Ejecuta todas las guardas y devuelve TODOS los fallos, no el primero.
 *
 * Sin efectos secundarios: no imprime ni termina el proceso, para que las
 * pruebas puedan comprobar el conjunto completo con un entorno simulado.
 */
export function fallosDeArranque(env: NodeJS.ProcessEnv = process.env): FalloDeArranque[] {
  const fallos: FalloDeArranque[] = [];

  for (const { asunto, comprobar } of GUARDAS) {
    try {
      comprobar(env);
    } catch (error) {
      fallos.push({
        asunto,
        mensaje: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return fallos;
}

/**
 * Comprobación de arranque: si falta configuración, informa de TODA la que
 * falta y termina.
 *
 * Se usa `process.exit` y no `throw` porque un throw en el gancho de arranque
 * puede quedar atrapado por el servidor y dejar el proceso vivo —que es
 * exactamente el defecto que estas guardas corrigen—.
 */
export async function assertConfiguracionDeArranqueOrExit(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const fallos = fallosDeArranque(env);
  if (fallos.length === 0) return;

  const encabezado =
    fallos.length === 1
      ? "\n✖ KORA no puede arrancar. Falta configurar 1 cosa:\n"
      : `\n✖ KORA no puede arrancar. Faltan ${fallos.length} cosas, y están TODAS aquí:\n`;

  const cuerpo = fallos
    .map(({ asunto, mensaje }, i) => `  ${i + 1}. ${asunto}\n     ${mensaje}`)
    .join("\n\n");

  console.error(`${encabezado}\n${cuerpo}\n`);
  process.exit(1);
}

/**
 * Comprobación EXCLUSIVA del worker: que el destino de los correos en disco se
 * pueda escribir de verdad.
 *
 * No está entre las guardas compartidas a propósito. La aplicación **no envía
 * correo** —todo cuelga de la bandeja de salida, y hay una prueba que impide
 * que el checkout importe el módulo de envío—, así que no tiene montado el
 * volumen de correos. Exigirle escribir ahí la tumbaría por un recurso que no
 * usa: pasó el 28 ago 2026 y tiró abajo el despliegue a pruebas.
 *
 * La regla que queda: **la guarda vive donde ocurre la escritura**, no en el
 * conjunto común.
 */
export async function assertDestinoDeCorreosOrExit(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    const { assertEmailDirWritable } = await import("@/modules/email/writable");
    await assertEmailDirWritable(env);
  } catch (error) {
    console.error(
      `\n✖ El worker de KORA no puede arrancar.\n  ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exit(1);
  }
}
