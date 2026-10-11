// Datos del comerciante: una sola fuente de verdad sobre qué hace falta para
// que las páginas legales sean válidas, y si está.
//
// Por qué existe este archivo aparte, igual que `src/modules/storage/config.ts`:
// la comprobación natural sería perezosa —mirar las variables al renderizar la
// página—, y eso significa que en producción, sin configurar, la aplicación
// ARRANCA bien, responde el login, atiende pedidos, y publica una política de
// tratamiento de datos que dice "[RAZÓN SOCIAL]" en el campo del responsable.
//
// Una política así no es un texto incompleto: es un consentimiento que no
// identifica a quién se le están dando los datos, y por tanto no acredita nada
// ante la SIC (Ley 1581/2012, art. 9). El fallo lo descubriría la autoridad o
// un comprador, no el despliegue.
//
// Se llama desde `src/instrumentation.ts` al arrancar el servidor.

import { esProduccion } from "@/lib/environment";

export const LEGAL_REQUIRED_VARS = [
  "KORA_LEGAL_RAZON_SOCIAL",
  "KORA_LEGAL_NIT",
  "KORA_LEGAL_DOMICILIO",
  "KORA_LEGAL_EMAIL",
  // Registro mercantil de la sociedad colombiana. KORA opera en dos países y
  // el centro legal publica el registro de cada sociedad (Daniel, 10 oct).
  "KORA_LEGAL_MATRICULA",
  // La sociedad de EE.UU. que procesa los pagos con tarjeta (cuenta comercial
  // de Bank of America). Las redes de tarjetas exigen que el sitio muestre la
  // dirección física y el país del comercio que cobra: publicarla con un
  // marcador no deja un texto incompleto, deja al comercio fuera de norma
  // ante el banco. Change `centro-legal`.
  "KORA_LEGAL_LLC_RAZON_SOCIAL",
  "KORA_LEGAL_LLC_DOMICILIO",
  "KORA_LEGAL_LLC_REGISTRO",
] as const;

export type LegalVar = (typeof LEGAL_REQUIRED_VARS)[number];

/** Datos del comerciante tal como aparecen en las páginas legales. */
export type Merchant = {
  razonSocial: string;
  nit: string;
  domicilio: string;
  /** Canal de atención al titular de datos personales. */
  email: string;
  /** Registro mercantil en Colombia, p. ej. "matrícula mercantil 0000435099 de la Cámara de Comercio del Huila" (en minúscula: va a mitad de frase). */
  matricula: string;
  /** La sociedad de EE.UU. que figura en los cobros con tarjeta. */
  llc: {
    razonSocial: string;
    /** Dirección física completa, con estado y país. */
    domicilio: string;
    /** Registro empresarial, p. ej. "UBI 606212090 (Washington)". */
    registro: string;
  };
  /** `true` cuando algún dato es un marcador de desarrollo, no el real. */
  incompleto: boolean;
};

/**
 * Marcadores de desarrollo.
 *
 * Se eligen en MAYÚSCULAS y entre corchetes a propósito: si alguna vez uno se
 * escapa a una pantalla, salta a la vista de quien la mire. Un valor plausible
 * como "KORA S.A.S." sería mucho peor — nadie notaría que es inventado.
 */
const MARCADOR: Record<LegalVar, string> = {
  KORA_LEGAL_RAZON_SOCIAL: "[RAZÓN SOCIAL PENDIENTE]",
  KORA_LEGAL_NIT: "[NIT PENDIENTE]",
  KORA_LEGAL_DOMICILIO: "[DOMICILIO PENDIENTE]",
  KORA_LEGAL_EMAIL: "[CORREO DE CONTACTO PENDIENTE]",
  KORA_LEGAL_MATRICULA: "[MATRÍCULA MERCANTIL PENDIENTE]",
  KORA_LEGAL_LLC_RAZON_SOCIAL: "[SOCIEDAD DE EE.UU. PENDIENTE]",
  KORA_LEGAL_LLC_DOMICILIO: "[DIRECCIÓN EN EE.UU. PENDIENTE]",
  KORA_LEGAL_LLC_REGISTRO: "[REGISTRO EMPRESARIAL PENDIENTE]",
};

/** Variables del comerciante que faltan o están vacías. Vacío = completo. */
export function missingLegalVars(env: NodeJS.ProcessEnv = process.env): LegalVar[] {
  return LEGAL_REQUIRED_VARS.filter((name) => !env[name]?.trim());
}

/**
 * Datos del comerciante para renderizar.
 *
 * En producción nunca devuelve marcadores, porque el proceso no habría
 * arrancado; en desarrollo sí, para no romper a quien clone el repositorio.
 */
export function merchant(env: NodeJS.ProcessEnv = process.env): Merchant {
  const valor = (name: LegalVar): string => env[name]?.trim() || MARCADOR[name];

  return {
    razonSocial: valor("KORA_LEGAL_RAZON_SOCIAL"),
    nit: valor("KORA_LEGAL_NIT"),
    domicilio: valor("KORA_LEGAL_DOMICILIO"),
    email: valor("KORA_LEGAL_EMAIL"),
    matricula: valor("KORA_LEGAL_MATRICULA"),
    llc: {
      razonSocial: valor("KORA_LEGAL_LLC_RAZON_SOCIAL"),
      domicilio: valor("KORA_LEGAL_LLC_DOMICILIO"),
      registro: valor("KORA_LEGAL_LLC_REGISTRO"),
    },
    incompleto: missingLegalVars(env).length > 0,
  };
}

export class LegalConfigError extends Error {
  readonly missing: readonly LegalVar[];

  constructor(missing: readonly LegalVar[]) {
    super(
      `Datos del comerciante sin configurar. Faltan estas variables de entorno: ${missing.join(", ")}. ` +
        "Las páginas legales identifican al responsable del tratamiento de datos y al comercio que cobra con tarjeta; " +
        "publicarlas con marcadores invalida el consentimiento que se pide en el checkout (Ley 1581/2012, art. 9) " +
        "y deja el sitio fuera de las normas de las redes de tarjetas.",
    );
    this.name = "LegalConfigError";
    this.missing = missing;
  }
}

/**
 * Lanza si en producción faltan datos del comerciante.
 *
 * En desarrollo y en PRUEBAS no hace nada, y lo segundo es deliberado: el
 * entorno de pruebas no necesita la razón social real del comerciante, y
 * exigírsela obligaría a copiar datos de una empresa de verdad a un entorno de
 * demostración. Ahí los marcadores son además útiles — se ve de un vistazo qué
 * insumo falta.
 *
 * Se usa `esProduccion()` y no `NODE_ENV`: la imagen se compila UNA vez con
 * `NODE_ENV=production` y corre en los dos entornos, así que `NODE_ENV` no
 * distingue pruebas de producción. Es el mismo predicado del correo y del
 * `robots.txt`.
 */
export function assertLegalConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (!esProduccion(env)) return;

  const missing = missingLegalVars(env);
  if (missing.length > 0) throw new LegalConfigError(missing);
}

/**
 * Comprobación de arranque: verifica y, si falta configuración, TERMINA.
 *
 * El `process.exit` vive aquí y no en `src/instrumentation.ts` por la misma
 * razón que en el módulo de almacenamiento: Next compila ese archivo TAMBIÉN
 * para el runtime edge, donde `process.exit` no existe, y el empaquetador lo
 * señala como error aunque haya una guarda en tiempo de ejecución. Este módulo
 * solo se carga mediante importación dinámica desde el runtime de Node.
 *
 * Se usa `process.exit` y no `throw` porque un throw en el gancho de arranque
 * puede quedar atrapado por el servidor y dejar el proceso vivo — que es
 * exactamente el defecto que esta guarda corrige.
 */
export function assertLegalConfiguredOrExit(env: NodeJS.ProcessEnv = process.env): void {
  try {
    assertLegalConfigured(env);
  } catch (error) {
    console.error(
      `\n✖ KORA no puede arrancar.\n  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
