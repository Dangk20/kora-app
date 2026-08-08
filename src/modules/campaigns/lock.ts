// Candado del módulo de Email marketing.
//
// **Por qué existe.** El módulo está construido entero, pero no puede hacer su
// trabajo: `korashopp.com` no tiene SPF, DKIM ni DMARC, y no hay cuenta de
// proveedor de envío (insumos del cliente, pendientes desde el 31 jul). Un
// módulo que se ve terminado y que al pulsar "Enviar" no envía es peor que un
// módulo que no está: el operador cree que la campaña salió.
//
// **Por qué es una decisión explícita y no una deducción.** Se podría abrir
// solo con mirar si hay proveedor configurado, pero eso ataría "listo para el
// negocio" a "hay una clave puesta", y son cosas distintas: la clave puede
// existir mientras el módulo sigue sin revisarse. Quien decide que esto se abre
// es una persona, y por eso hay que declararlo.
//
// **Por omisión, CERRADO.** Un entorno nuevo donde nadie se acuerde de la
// variable se queda cerrado — el lado inofensivo del error. Es el mismo criterio
// que `KORA_ENV` con el correo y que el driver de almacenamiento: la
// configuración incompleta nunca se resuelve sola hacia el lado peligroso.
//
// Este archivo NO importa nada: lo leen el servidor, las acciones y —vía
// props— el menú del panel.

/**
 * Qué falta para abrirlo. Se le enseña al operador tal cual, porque el cliente
 * es quien tiene que traer estos dos insumos.
 */
export const MARKETING_LOCK_REASON =
  "Falta la cuenta del proveedor de envío y publicar SPF, DKIM y DMARC en el dominio. " +
  "Hasta entonces una campaña no llegaría a la bandeja de entrada.";

/**
 * El entorno como lo necesita este archivo: un mapa de cadenas.
 *
 * No se usa `NodeJS.ProcessEnv` porque obliga a que todo objeto de prueba
 * declare `NODE_ENV`, y aquí eso no aporta nada: lo único que se lee es una
 * variable.
 */
type Entorno = Record<string, string | undefined>;

/** ¿Está abierto el módulo? Solo si alguien lo declaró en voz alta. */
export function marketingEnabled(env: Entorno = process.env): boolean {
  const v = env.KORA_MARKETING_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export class MarketingLockedError extends Error {
  constructor() {
    super(`Email marketing está cerrado. ${MARKETING_LOCK_REASON}`);
    this.name = "MarketingLockedError";
  }
}

/**
 * Corta la acción si el módulo está cerrado.
 *
 * Va en TODA acción del módulo, no solo en las de envío: si solo se cerrara el
 * envío, se podrían seguir componiendo y programando campañas que nadie va a
 * poder mandar, y quedaría trabajo hecho a medias esperando en la base.
 *
 * Y va en el servidor, no en la pantalla: ocultar un botón no cierra nada:
 * la acción sigue estando a un POST de distancia.
 */
export function assertMarketingUnlocked(env: Entorno = process.env): void {
  if (!marketingEnabled(env)) throw new MarketingLockedError();
}
