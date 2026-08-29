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

/** Manda la bienvenida. Devuelve si salió, para el registro — nunca para la pantalla. */
export async function sendWelcomeEmail(to: string, name: string | null): Promise<boolean> {
  const { html, text } = renderCampaign({
    subject: ASUNTO,
    preheader: "Tu cuenta ya está lista.",
    title: "Tu cuenta ya está lista",
    body:
      "Gracias por crear tu cuenta en KORA. Desde aquí puedes ver el estado de tus pedidos, " +
      "consultar tu historial de compras y llevar el saldo de tu Kora Cashback.\n\n" +
      "Si ya habías comprado con este mismo correo, tus pedidos anteriores y tu cashback " +
      "aparecen solos: no hay nada que reclamar ni que migrar.",
    products: [],
    // Vacío A PROPÓSITO: esto no es publicidad. La baja de marketing es otra
    // lista, y darse de baja de ella no cancela una cuenta.
    unsubscribeUrl: "",
    recipientName: name,
    ctaLabel: "Ver mi cuenta",
    ctaUrl: `${storeUrl()}/cuenta`,
    order: null,
  });

  const r = await emailDriver().send({ to, toName: name ?? undefined, subject: ASUNTO, html, text });
  return r.ok;
}
