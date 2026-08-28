// Dónde deja los correos el driver de disco, y cuándo se usa ese driver.
//
// Vive aparte del propio driver para que la comprobación de arranque pueda
// preguntarlo sin arrastrar el módulo de envío entero: hay una prueba que
// impide que la creación y la confirmación del pedido importen ese módulo, y
// una guarda que lo importara para saber una ruta sería justo la clase de
// dependencia que esa prueba existe para evitar.

import { emailProviderConfigured } from "./config";
import { esProduccion } from "@/lib/environment";

/** La carpeta donde se escriben los `.eml`. */
export function emailDevDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_DEV_DIR?.trim() || ".emails";
}

/**
 * ¿Se está usando el driver de disco?
 *
 * En producción manda el proveedor. Fuera de producción se escribe a disco
 * salvo que alguien haya configurado un proveedor a propósito.
 */
export function usaDriverDeDisco(env: NodeJS.ProcessEnv = process.env): boolean {
  if (esProduccion(env)) return false;
  return !emailProviderConfigured(env);
}
