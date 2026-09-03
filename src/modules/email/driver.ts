// El contrato de envío de correo.
// Ver openspec/changes/email-marketing — specs/email-delivery.
//
// Deliberadamente MÍNIMO: cuanto menos asuma del proveedor, menos habrá que
// rehacer cuando exista la cuenta. Un correo, un destinatario, dos versiones
// del cuerpo, y el enlace de baja como dato de primera clase porque los
// clientes de correo lo usan para su botón nativo.

/**
 * Un archivo que viaja con el correo.
 *
 * `content` son los BYTES, no una ruta: quien envía puede ser el worker, que
 * corre en su propio contenedor, y una ruta obligaría a que ambos vieran el
 * mismo disco.
 */
export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
};

export type EmailMessage = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Siempre. Un correo sin versión de texto es una señal de spam. */
  text: string;
  /** Para el encabezado `List-Unsubscribe`: el botón nativo de Gmail/Outlook. */
  unsubscribeUrl?: string;
  /**
   * Archivos adjuntos. Los dos drivers TIENEN que entregarlos: el de
   * producción con el mensaje, el de desarrollo escribiéndolos a disco para
   * que se puedan abrir y revisar.
   */
  attachments?: EmailAttachment[];
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

// La base pública de la tienda se movió a `src/lib/site.ts` cuando dejó de ser
// solo cosa del correo: el `robots.txt`, el sitemap y la metadata para
// compartir necesitan la misma. Se reexporta para no tocar a sus consumidores.
export { storeUrl } from "@/lib/site";
