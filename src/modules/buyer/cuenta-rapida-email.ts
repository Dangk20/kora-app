// El correo de la cuenta creada desde la ruleta (registro rápido, sin
// contraseña en el momento). Lleva la contraseña TEMPORAL de esa persona: al
// primer acceso la tienda le pide cambiarla (`/cuenta/nueva-clave`).
//
// Como la bienvenida, se envía después de crear la cuenta y su fallo se traga:
// la persona ya giró y su premio está guardado; si el correo no llega, puede
// entrar con "¿Olvidaste tu contraseña?".
import { emailDriver } from "@/modules/email";
import { storeUrl } from "@/modules/email/driver";
import { renderCampaign } from "@/modules/email/template";

const ASUNTO = "Tu cuenta KORA está lista 🎁";

export async function sendCuentaRapidaEmail(to: string, name: string | null, clave: string): Promise<boolean> {
  const { html, text } = renderCampaign({
    subject: ASUNTO,
    preheader: "Tu premio de la ruleta ya está guardado en tu cuenta.",
    title: "Tu cuenta KORA está lista",
    body:
      "Gracias por girar la ruleta de la gran apertura. Tu premio quedó guardado en tu cuenta, " +
      "en \"Mis beneficios\".\n\n" +
      "Para entrar a tu cuenta usa este correo y esta contraseña temporal:\n\n" +
      `${clave}\n\n` +
      "La primera vez que entres te pediremos cambiarla por una tuya.",
    promo: null,
    footer: null,
    products: [],
    // No es publicidad: es el acceso a una cuenta que la persona creó.
    unsubscribeUrl: "",
    recipientName: name,
    ctaLabel: "Entrar a mi cuenta",
    ctaUrl: `${storeUrl()}/cuenta/entrar`,
    order: null,
  });
  const r = await emailDriver().send({ to, toName: name ?? undefined, subject: ASUNTO, html, text });
  return r.ok;
}
