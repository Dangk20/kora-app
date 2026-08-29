// El correo con el código de recuperación.
//
// ── Por qué este SÍ se envía desde la acción ──────────────────────────────
//
// El resto del sistema tiene una regla dura: nada se envía desde la acción,
// todo cuelga de la bandeja de salida. Esa regla existe para no perder una
// VENTA por un proveedor caído — cambiar un problema pequeño (no llega un
// comprobante) por el peor (se cae el pedido).
//
// Aquí el cálculo se invierte. La persona está delante de la pantalla esperando
// seis dígitos; encolar el envío significa que la pantalla dice "te lo
// enviamos" y el correo sale cuando el worker pase. Y si falla, no se pierde
// nada: pide otro código. Encolarlo añadiría latencia sin comprar seguridad.
//
// Lo que sí se conserva es lo importante: si el envío falla, la acción NO
// revela que falló —eso delataría que el correo tiene cuenta— y el código
// emitido simplemente caduca solo.

import { emailDriver } from "@/modules/email";
import { renderCampaign } from "@/modules/email/template";
import { VIGENCIA_CODIGO_MS } from "./reset";

const MINUTOS = Math.round(VIGENCIA_CODIGO_MS / 60_000);

/**
 * Manda el código. Devuelve si salió, para el registro — **nunca** para la
 * pantalla.
 */
export async function sendResetCode(
  to: string,
  code: string,
  name: string | null,
): Promise<boolean> {
  const { html, text } = renderCampaign({
    subject: "Tu código para cambiar la contraseña",
    preheader: `Código ${code}. Caduca en ${MINUTOS} minutos.`,
    title: "Cambia tu contraseña",
    body:
      `Pediste cambiar la contraseña de tu cuenta de KORA. Tu código es:\n\n` +
      `${code}\n\n` +
      `Caduca en ${MINUTOS} minutos y solo sirve una vez.\n\n` +
      "Si no fuiste tú, puedes ignorar este correo: tu contraseña no cambia " +
      "mientras nadie use el código, y quien lo pidió no puede verlo.",
    products: [],
    // Vacío A PROPÓSITO: esto no es publicidad y no se puede dar de baja.
    unsubscribeUrl: "",
    recipientName: name,
    ctaLabel: null,
    ctaUrl: null,
    order: null,
  });

  const r = await emailDriver().send({
    to,
    toName: name ?? undefined,
    subject: "Tu código para cambiar la contraseña",
    html,
    text,
  });

  return r.ok;
}
