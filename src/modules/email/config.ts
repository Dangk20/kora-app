// Configuración del correo: una sola fuente de verdad sobre qué variables
// hacen falta y si están.
//
// Existe aparte por la misma razón que su gemelo del almacenamiento: la
// comprobación dentro del driver sería perezosa, y en producción eso significa
// que la aplicación ARRANCA bien, pasa cualquier verificación de salud, y solo
// falla cuando alguien lanza la primera campaña — es decir, delante del
// cliente. Ese error ya se cometió una vez con las imágenes; no se repite.
//
// Se llama desde `src/instrumentation.ts` al arrancar el servidor.
// Ver openspec/changes/email-marketing — specs/email-delivery.

import { esProduccion } from "@/lib/environment";

export const EMAIL_REQUIRED_VARS = ["RESEND_API_KEY", "EMAIL_FROM"] as const;

export type EmailVar = (typeof EMAIL_REQUIRED_VARS)[number];

/** Variables del proveedor que faltan o están vacías. Vacío = configurado. */
export function missingEmailVars(env: NodeJS.ProcessEnv = process.env): EmailVar[] {
  return EMAIL_REQUIRED_VARS.filter((name) => !env[name]?.trim());
}

/** ¿Hay proveedor real? Decide el driver y qué métricas se pueden prometer. */
export function emailProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return missingEmailVars(env).length === 0;
}

/**
 * Destinatarios a los que el proveedor SÍ entrega fuera de producción.
 *
 * La base de pruebas tiene direcciones de personas reales —quien prueba un
 * pedido escribe la suya—, así que darle el proveedor a pruebas sin más haría
 * que una campaña de demostración le llegara a alguien de verdad. Con la lista,
 * a estas direcciones el correo sale de verdad y a cualquier otra va a disco.
 *
 * Se compara en minúsculas y sin espacios: es como el resto del módulo
 * normaliza una dirección antes de reservarla.
 */
export const ALLOWLIST_VAR = "KORA_EMAIL_ALLOWLIST";

export function emailAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env[ALLOWLIST_VAR] ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export class EmailAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailAllowlistError";
  }
}

export class EmailConfigError extends Error {
  readonly missing: readonly EmailVar[];

  constructor(missing: readonly EmailVar[]) {
    super(
      `Envío de correo sin configurar. Faltan estas variables de entorno: ${missing.join(", ")}. ` +
        "En producción los correos salen por el proveedor, y el dominio necesita además " +
        "SPF, DKIM y DMARC publicados (plan técnico §S13).",
    );
    this.name = "EmailConfigError";
    this.missing = missing;
  }
}

/**
 * ¿Es este el entorno donde el correo DEBE salir de verdad?
 *
 * No basta con `NODE_ENV`: la imagen se compila una sola vez con
 * `NODE_ENV=production` y se usa en pruebas y en producción. Sin distinguirlas,
 * exigir el proveedor tumbaría también el entorno de pruebas — donde además
 * NO QUEREMOS que salga correo real: staging escribiría a direcciones de
 * clientes de verdad mientras alguien prueba un pedido.
 *
 * El predicado vive en `src/lib/environment.ts` y NO se reimplementa aquí:
 * el rastreo (`src/app/robots.ts`) hace la misma pregunta, y dos copias de la
 * misma regla son dos sitios donde cambiar uno y olvidar el otro.
 */
export function requiereProveedor(env: NodeJS.ProcessEnv = process.env): boolean {
  return esProduccion(env);
}

/** Lanza si el entorno exige proveedor y falta configuración. */
export function assertEmailConfigured(env = process.env): void {
  const lista = emailAllowlist(env);

  if (requiereProveedor(env)) {
    const missing = missingEmailVars(env);
    if (missing.length > 0) throw new EmailConfigError(missing);
    // Una lista olvidada en producción dejaría a los compradores sin sus
    // correos SIN NINGÚN ERROR: irían a disco dentro del contenedor. La
    // configuración ambigua se rechaza, nunca se interpreta.
    if (lista.size > 0) {
      throw new EmailAllowlistError(
        `${ALLOWLIST_VAR} está definida y este entorno es PRODUCCIÓN. ` +
          "La lista de destinatarios permitidos solo existe para pruebas: aquí todo comprador " +
          "tiene que recibir sus correos. Quítala.",
      );
    }
    return;
  }

  // En desarrollo —y en pruebas— el driver de disco funciona sin configurar
  // nada: exigirlo haría imposible trabajar sin una cuenta de proveedor.
  // Pero si ALGUIEN puso el proveedor aquí, tiene que decir a quién se le
  // puede escribir: es justo la fuga que se quiere impedir.
  if (emailProviderConfigured(env) && lista.size === 0) {
    throw new EmailAllowlistError(
      `Hay proveedor de correo configurado y este entorno NO es producción, pero falta ${ALLOWLIST_VAR}. ` +
        "Sin ella, cualquier correo de pruebas saldría a direcciones reales. " +
        "Pon las direcciones permitidas separadas por comas, o quita RESEND_API_KEY.",
    );
  }
}

/**
 * Igual que la anterior, pero termina el proceso.
 *
 * El `process.exit` vive aquí y no en `instrumentation.ts` porque Next compila
 * ese archivo también para el runtime de edge, donde `process.exit` no existe.
 */
export function assertEmailConfiguredOrExit(env = process.env): void {
  try {
    assertEmailConfigured(env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
