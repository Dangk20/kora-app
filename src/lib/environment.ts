// Qué entorno es este. UNA definición, consumida por todos.
//
// El problema que resuelve: la imagen se compila UNA sola vez con
// `NODE_ENV=production` y esa misma imagen corre en pruebas y en producción.
// `NODE_ENV` no distingue los dos entornos que sí se comportan distinto: en
// pruebas el correo se escribe a disco y el sitio no debe indexarse; en
// producción el correo sale de verdad y el sitio debe aparecer en Google.
//
// La distinción la hace `KORA_ENV`, y sigue la convención ya desplegada
// (`deploy/README.md` §Variables): **solo el entorno de pruebas se declara**
// (`KORA_ENV=staging`). `.env.production` NO lleva la variable.
//
// Por eso "ausente" significa producción y no al revés. Invertirlo parece más
// prudente —fallar hacia lo seguro— pero contra el despliegue real significaría
// publicar producción con `Disallow: /`: la tienda nunca aparecería en Google y
// nada fallaría, ni en el despliegue ni en ninguna pantalla.
//
// Vive en `src/lib/` y no dentro de un módulo de dominio porque lo consumen
// dominios distintos (correo, rastreo). Tener dos predicados equivalentes en
// dos módulos es la forma habitual de que uno cambie y el otro no.

/**
 * ¿Es este el entorno de pruebas?
 *
 * Es el único que se declara a sí mismo, así que es la pregunta que tiene
 * respuesta fiable.
 */
export function esStaging(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KORA_ENV?.trim().toLowerCase() === "staging";
}

/**
 * ¿Es este un despliegue de producción real, sirviendo a clientes?
 *
 * Falso en desarrollo (no es build de producción) y falso en pruebas
 * (se declara `staging`).
 */
export function esProduccion(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && !esStaging(env);
}
