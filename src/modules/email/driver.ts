// El contrato de envío de correo.
// Ver openspec/changes/email-marketing — specs/email-delivery.
//
// Deliberadamente MÍNIMO: cuanto menos asuma del proveedor, menos habrá que
// rehacer cuando exista la cuenta. Un correo, un destinatario, dos versiones
// del cuerpo, y el enlace de baja como dato de primera clase porque los
// clientes de correo lo usan para su botón nativo.

export type EmailMessage = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Siempre. Un correo sin versión de texto es una señal de spam. */
  text: string;
  /** Para el encabezado `List-Unsubscribe`: el botón nativo de Gmail/Outlook. */
  unsubscribeUrl?: string;
};

export type SendResult =
  | { ok: true; providerId: string }
  | { ok: false; error: string; permanent: boolean };

export type EmailDriver = {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
};

/** Remitente configurado. Sin él, en producción la aplicación no arranca. */
export function fromAddress(env = process.env): string {
  return env.EMAIL_FROM?.trim() || "KORA <no-responder@korashopp.com>";
}

/** Base pública de la tienda, para armar enlaces absolutos dentro del correo. */
export function storeUrl(env = process.env): string {
  return (env.NEXT_PUBLIC_STORE_URL?.trim() || "https://korashopp.com").replace(/\/+$/, "");
}
