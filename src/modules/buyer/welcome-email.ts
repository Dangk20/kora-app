// El correo de bienvenida, al crear la cuenta.
//
// ── Cuándo NO se manda, que es lo que importa ─────────────────────────────
//
// `registerBuyer` tiene tres caminos y desde fuera son uno solo: correo nuevo,
// correo que ya era cliente (compró como invitado y ahora le ponemos
// contraseña), y correo que YA tenía cuenta —donde no se toca nada—.
//
// La bienvenida sale en los dos primeros y NO en el tercero, porque en el
// tercero no se creó ninguna cuenta. Eso además cierra un hueco: quien intente
// registrarse con el correo de otra persona no consigue que a esa persona le
// llegue un "bienvenido" que no pidió.
//
// Y al revés, en los dos primeros el correo es útil aunque quien registre no
// sea el dueño de la dirección: el dueño se entera de que existe una cuenta a
// su nombre, que es justo lo que querría saber.
//
// ── Por qué no rompe el registro ──────────────────────────────────────────
//
// Se envía después de que la cuenta ya está creada, y su fallo se traga. Nadie
// debería quedarse sin cuenta porque un proveedor de correo tuvo un mal
// segundo: la cuenta es lo que la persona pidió, la bienvenida es cortesía.

import { emailDriver } from "@/modules/email";
import { renderCampaign } from "@/modules/email/template";
import { storeUrl } from "@/modules/email/driver";

// "Te damos la bienvenida" y no "Bienvenido".
//
// El asunto es lo primero —y a veces lo único— que alguien lee de KORA, y
// "bienvenido" le asigna un género a quien todavía no conocemos. La tienda
// vende belleza, hogar y accesorios: dar por hecho el género de quien compra
// es equivocarse con una parte de la clientela en el primer contacto.
//
// La fórmula neutra no cuesta nada y funciona para todo el mundo. Misma regla
// para el resto de los correos: nada de "estimado", "querido" ni participios
// que concuerden con la persona.
const ASUNTO = "Te damos la bienvenida a KORA 🧡";

/**
 * Campaña de lanzamiento (pedido del cliente, 5 oct 2026): quien cree su
 * cuenta entre el 5 oct, 8:00 p. m., y el 9 oct, 8:00 p. m. (hora de
 * Colombia), recibe en la bienvenida el cupón BIENVENIDOSAKORA: 7 % en su
 * primera compra, una sola vez, hasta el 31 oct, 11:59 p. m. El cupón vive en
 * el módulo de Cupones con esas reglas (primera compra, 1 por cliente,
 * vencimiento); aquí solo se decide QUIÉN lo recibe y cómo se ve.
 *
 * Fechas en UTC: Colombia es UTC−5 todo el año (sin horario de verano).
 */
export const CUPON_BIENVENIDA = {
  codigo: "BIENVENIDOSAKORA",
  desde: new Date("2026-10-06T01:00:00Z"), // 5 oct, 8:00 p. m. Colombia
  // La publicación en redes dice "al viernes 9 de octubre · 8:00 p. m." y es
  // lo que vio la gente: manda sobre las instrucciones iniciales (6 oct).
  hasta: new Date("2026-10-10T01:00:00Z"), // 9 oct, 8:00 p. m. Colombia
} as const;

export function recibeCuponBienvenida(ahora: Date = new Date()): boolean {
  return ahora >= CUPON_BIENVENIDA.desde && ahora < CUPON_BIENVENIDA.hasta;
}

/** Manda la bienvenida. Devuelve si salió, para el registro — nunca para la pantalla. */
export async function sendWelcomeEmail(to: string, name: string | null): Promise<boolean> {
  const conCupon = recibeCuponBienvenida();
  const asunto = conCupon ? "🎉 ¡KORA abrió sus puertas! Tu cupón de 7 % te espera" : ASUNTO;
  const { html, text } = renderCampaign({
    subject: asunto,
    preheader: conCupon
      ? "Tu cuenta ya está lista y tienes 7 % de descuento en tu primera compra."
      : "Tu cuenta ya está lista.",
    title: conCupon ? "🎉 ¡Abrimos y tú llegaste primero!" : "Tu cuenta ya está lista",
    body: conCupon
      ? "Hoy celebramos la apertura de nuestra tienda en línea y queremos celebrarla contigo. " +
        "Tu cuenta ya está lista y, por ser de los primeros en llegar, este regalo es para ti:"
      : "Gracias por crear tu cuenta en KORA. Desde aquí puedes ver el estado de tus pedidos, " +
        "consultar tu historial de compras y llevar el saldo de tu Kora Cashback.\n\n" +
        "Si ya habías comprado con este mismo correo, tus pedidos anteriores y tu cashback " +
        "aparecen solos: no hay nada que reclamar ni que migrar.",
    promo: conCupon
      ? {
          codigo: CUPON_BIENVENIDA.codigo,
          // La publicación en redes, recortada antes de su botón (public/email/).
          imagenUrl: "/email/apertura-kora.jpg",
          redimirHasta: "31 de octubre de 2026 a las 11:59 p. m. (hora Colombia)",
        }
      : null,
    footer: conCupon
      ? "Válido una sola vez, solo en tu primera compra. Este cupón es personal: te llegó por " +
        "haber creado tu cuenta."
      : null,
    products: [],
    // Vacío A PROPÓSITO: esto no es publicidad. La baja de marketing es otra
    // lista, y darse de baja de ella no cancela una cuenta.
    unsubscribeUrl: "",
    recipientName: name,
    ctaLabel: conCupon ? "Estrenar mi cupón" : "Ver mi cuenta",
    ctaUrl: conCupon ? storeUrl() : `${storeUrl()}/cuenta`,
    order: null,
  });

  const r = await emailDriver().send({ to, toName: name ?? undefined, subject: asunto, html, text });
  return r.ok;
}
