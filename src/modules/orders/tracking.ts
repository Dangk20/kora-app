// Seguimiento del pedido SIN cuenta (alcance §1.9).
//
// El checkout permite comprar como invitado —así está diseñado— pero hasta el
// 27 ago 2026 la única pantalla de seguimiento exigía sesión de comprador. Un
// invitado terminaba su compra y no tenía ninguna forma de saber en qué iba,
// salvo escribir por WhatsApp. Con los correos todavía bloqueados por el DNS
// del dominio, eso convertía cada pedido en una conversación manual: justo lo
// que el módulo de correos venía a evitar.
//
// ── Por qué el número del pedido NO basta ────────────────────────────────
//
// `orders.number` es un autoincremento. Quien tenga un pedido tiene también el
// número del de al lado, y del siguiente, y de todos: publicar el estado con
// solo ese dato entregaría nombre, teléfono, dirección y compras de cualquier
// cliente a quien cuente de uno en uno. Por eso hace falta un segundo dato que
// el comprador sepa y un desconocido no: el correo o el teléfono del pedido.
//
// ── Y por qué después va un token firmado ────────────────────────────────
//
// Comprobado el par (número + contacto), se emite un enlace firmado. Así la
// página del estado no necesita que el correo viaje en la URL —ni quedar en el
// historial del navegador, ni en el registro del servidor, ni en la cabecera
// `Referer` de cualquier recurso externo—, y el mismo enlace podrá ir dentro
// de los correos del pedido el día que el dominio pueda enviarlos.
//
// Mismo mecanismo que el enlace de baja (`modules/consent/token.ts`): HMAC,
// comparación en tiempo constante y nada que guardar.

import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { digitsOf, toE164 } from "@/modules/customers/phone";

/**
 * Reusa el secreto del despliegue, como el enlace de baja: uno más sería una
 * variable más que olvidar en producción, y el alcance de este token —ver un
 * pedido propio— es estrictamente menor que el de una sesión.
 */
function secreto(env = process.env): string {
  const s = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  if (s) return s;
  if (env.NODE_ENV === "production") {
    throw new Error("Falta AUTH_SECRET: no se pueden firmar los enlaces de seguimiento.");
  }
  return "kora-dev-tracking-secret";
}

function firma(orderId: string, env = process.env): string {
  // Prefijo de propósito: sin él, un token de seguimiento y uno de baja
  // firmarían la misma cadena con la misma clave, y valdrían el uno por el
  // otro. Son dos permisos distintos y no deben ser intercambiables.
  return createHmac("sha256", secreto(env))
    .update(`pedido:${orderId}`)
    .digest("base64url")
    .slice(0, 32);
}

/** El token que viaja en el enlace: identificador del pedido + firma. */
export function trackingToken(orderId: string, env = process.env): string {
  return `${orderId}.${firma(orderId, env)}`;
}

/**
 * Devuelve el identificador del pedido si el token es legítimo, o null.
 *
 * En tiempo constante: una comparación normal filtra, por lo que tarda en
 * fallar, cuántos caracteres del principio acertó quien lo intenta.
 */
export function verifyTrackingToken(token: string, env = process.env): string | null {
  const corte = token.lastIndexOf(".");
  if (corte <= 0) return null;

  const orderId = token.slice(0, corte);
  const recibida = Buffer.from(token.slice(corte + 1));
  const esperada = Buffer.from(firma(orderId, env));

  if (recibida.length !== esperada.length) return null;
  return timingSafeEqual(recibida, esperada) ? orderId : null;
}

/**
 * Busca un pedido por su número y un dato de contacto del propio pedido.
 *
 * El contacto va **en el `where`**, nunca en una comprobación posterior: un
 * pedido cuyo contacto no coincide sencillamente no existe para esta consulta.
 * Es la misma regla que rige la cuenta del comprador, y la diferencia entre
 * que algo sea privado y que lo parezca.
 *
 * Acepta correo o celular indistintamente porque el comprador no tiene por qué
 * recordar cuál escribió, y exigir el correcto solo añadiría un intento
 * fallido a alguien que ya demostró conocer los dos datos que importan.
 */
export async function findOrderForTracking(
  numero: number,
  contacto: string,
  client: typeof db = db,
): Promise<{ id: string } | null> {
  const limpio = contacto.trim();
  if (!limpio) return null;

  const email = limpio.toLowerCase();

  // El teléfono se guarda en E.164; quien escribe "3105557788" busca lo mismo
  // que quien escribe "+57 310 555 7788". Se prueban los dos países del
  // alcance porque aquí todavía no se sabe de cuál es el pedido.
  //
  // ⚠️ Solo si lo escrito parece un teléfono. `toE164` normaliza lo que le den:
  // sobre un correo devuelve el prefijo suelto —"+57"— y eso sería un valor de
  // búsqueda real, no vacío. Un `where` con basura plausible es peor que uno
  // sin la condición.
  const digitos = digitsOf(limpio);
  const telefonos =
    digitos.length >= 7 ? [limpio, toE164(limpio, "CO"), toE164(limpio, "US")] : [];

  return client.order.findFirst({
    where: {
      number: numero,
      OR: [
        { contactEmail: email },
        ...(telefonos.length > 0 ? [{ contactPhone: { in: telefonos } }] : []),
      ],
    },
    select: { id: true },
  });
}

/**
 * El mensaje cuando no se encuentra. **Uno solo, siempre.**
 *
 * Distinguir "ese pedido no existe" de "los datos no coinciden" convertiría
 * esta pantalla en un buscador: probando números con un correo cualquiera se
 * sabría qué números existen, y probando correos sobre un número conocido, de
 * quién es. El mensaje es idéntico en los dos casos, a propósito.
 */
export const TRACKING_NOT_FOUND =
  "No encontramos un pedido con esos datos. Revisa el número y el correo o celular que usaste al comprarlo.";

/**
 * Lee el número del pedido tal como el comprador lo tiene delante.
 *
 * Acepta `KO-2026-00004` y `4`. Exigir solo los dígitos sería obligarle a
 * traducir un formato que la propia tienda inventó, y el año que lleva dentro
 * es justo lo que hace que concatenar los dígitos dé `2026000004`: el número
 * es el ÚLTIMO tramo, no todos los dígitos de la cadena.
 *
 * Devuelve null si no hay un número plausible; quien llama no debe distinguir
 * ese caso de "no existe" (ver TRACKING_NOT_FOUND).
 */
export function parseOrderNumber(entrada: string): number | null {
  const ultimo = entrada.trim().split("-").pop() ?? "";
  const digitos = ultimo.replace(/\D/g, "");
  if (!digitos) return null;

  // `padStart(5, "0")` en el formato: "00004" tiene que leerse como 4.
  const n = Number(digitos);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
