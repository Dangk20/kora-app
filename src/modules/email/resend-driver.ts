// Driver de producción: el proveedor de envío.
// Ver openspec/changes/email-marketing — specs/email-delivery.
//
// ⚠️ NO SE HA PROBADO CONTRA EL PROVEEDOR REAL. El dominio todavía no tiene
// SPF/DKIM/DMARC y no hay cuenta, así que este archivo está escrito contra la
// API documentada y verificado solo en su forma. Activar el proveedor incluye
// probar un envío real: hasta entonces, esto es una promesa razonable, no un
// hecho. Se usa `fetch` y no el SDK del proveedor a propósito — una dependencia
// menos y un contrato que se lee entero en 40 líneas.

import type { EmailDriver, EmailMessage, SendResult } from "./driver";
import { fromAddress } from "./driver";

const ENDPOINT = "https://api.resend.com/emails";

/**
 * Un error 4xx no se arregla reintentando (dirección inválida, contenido
 * rechazado); un 5xx o un fallo de red, sí. Distinguirlos evita que el
 * despachador gaste intentos en algo que nunca va a salir.
 */
function esPermanente(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

export function createResendDriver(apiKey: string, from = fromAddress()): EmailDriver {
  return {
    name: "resend",
    async send(msg: EmailMessage): Promise<SendResult> {
      const headers: Record<string, string> = {};
      if (msg.unsubscribeUrl) {
        // El botón nativo de baja del cliente de correo. Va aquí y no en el
        // cuerpo porque es lo que Gmail y Outlook leen para ofrecerlo.
        headers["List-Unsubscribe"] = `<${msg.unsubscribeUrl}>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }

      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [msg.toName ? `${msg.toName} <${msg.to}>` : msg.to],
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
            // El proveedor recibe el contenido en base64 dentro del JSON. No
            // se manda `content_type`: lo deduce de la extensión, y mandarlo
            // mal es peor que no mandarlo.
            ...(msg.attachments && msg.attachments.length > 0
              ? {
                  attachments: msg.attachments.map((a) => ({
                    filename: a.filename,
                    content: Buffer.from(a.content).toString("base64"),
                  })),
                }
              : {}),
          }),
        });

        if (!res.ok) {
          const detalle = await res.text().catch(() => "");
          return {
            ok: false,
            error: `${res.status} ${detalle.slice(0, 200)}`.trim(),
            permanent: esPermanente(res.status),
          };
        }

        const cuerpo = (await res.json()) as { id?: string };
        return { ok: true, providerId: cuerpo.id ?? "sin-id" };
      } catch (e) {
        // Fallo de red: transitorio por definición.
        return {
          ok: false,
          error: e instanceof Error ? e.message : "fallo de red",
          permanent: false,
        };
      }
    },
  };
}
