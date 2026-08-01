// Límite de intentos de acceso.
// Ver openspec/changes/cuenta-comprador — specs/buyer-authentication.
//
// Sin límite, probar contraseñas contra una cuenta es cuestión de tiempo y
// ancho de banda. Detrás de esta cuenta hay saldo gastable.
//
// ⚠️ VIVE EN MEMORIA DEL PROCESO. Hay UNA instancia de la aplicación, y añadir
// Redis para esto sería complejidad al servicio de una escala que no existe.
// Si algún día corre más de una instancia, el contador deja de ser global y
// hay que moverlo — está anotado en las notas técnicas privadas.

const VENTANA_MS = 15 * 60_000;
const MAX_INTENTOS = 8;

type Registro = { intentos: number; desde: number };

const intentos = new Map<string, Registro>();

/** Limpia lo caducado. Sin esto el mapa crece con cada origen que pase. */
function purgar(ahora: number): void {
  for (const [clave, r] of intentos) {
    if (ahora - r.desde > VENTANA_MS) intentos.delete(clave);
  }
}

export type LimiteResultado = { permitido: true } | { permitido: false; esperaSegundos: number };

export function comprobarLimite(clave: string, ahora = Date.now()): LimiteResultado {
  purgar(ahora);
  const r = intentos.get(clave);
  if (!r || ahora - r.desde > VENTANA_MS) return { permitido: true };
  if (r.intentos < MAX_INTENTOS) return { permitido: true };
  return {
    permitido: false,
    esperaSegundos: Math.ceil((VENTANA_MS - (ahora - r.desde)) / 1000),
  };
}

export function registrarFallo(clave: string, ahora = Date.now()): void {
  const r = intentos.get(clave);
  if (!r || ahora - r.desde > VENTANA_MS) {
    intentos.set(clave, { intentos: 1, desde: ahora });
    return;
  }
  r.intentos += 1;
}

/** Un acceso correcto limpia el contador de ese origen. */
export function limpiarIntentos(clave: string): void {
  intentos.delete(clave);
}

/** Solo para pruebas. */
export function _reiniciarLimite(): void {
  intentos.clear();
}
