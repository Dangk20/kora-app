// Driver de desarrollo: escribe el correo a disco en vez de enviarlo.
// Ver openspec/changes/email-marketing — specs/email-delivery.
//
// Escribe un `.eml` de verdad, no un registro que diga "se envió", para que el
// correo se pueda ABRIR y LEER. Un correo roto —un enlace mal armado, un pie
// que se perdió, un precio que no debería estar— se ve; deducirlo de un log no
// se puede. Y sin esto no habría forma de trabajar en el módulo, porque el
// dominio todavía no tiene registros de correo ni hay cuenta de proveedor.

import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { EmailDriver, EmailMessage, SendResult } from "./driver";
import { fromAddress } from "./driver";

// La carpeta la decide `file-target.ts`, que es también quien consulta la
// guarda de arranque: una sola definición, o la comprobación de escritura
// vigilaría un directorio distinto del que se escribe.
import { emailDevDir } from "./file-target";

/** Codifica en base64 con saltos, que es lo que un `.eml` espera. */
function base64(texto: string): string {
  return (Buffer.from(texto, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

function nombreArchivo(msg: EmailMessage): string {
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = msg.to.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  return `${sello}__${destino}__${randomUUID().slice(0, 8)}.eml`;
}

/**
 * Arma el correo completo, con las dos versiones del cuerpo.
 *
 * Es un `multipart/alternative` real: el cliente de correo elige. Se construye
 * igual que lo haría el proveedor para que lo que se revisa en desarrollo se
 * parezca a lo que sale en producción.
 */
export function buildEml(msg: EmailMessage, from = fromAddress()): string {
  const limite = `kora-${randomUUID()}`;
  const cabeceras = [
    `From: ${from}`,
    `To: ${msg.toName ? `${msg.toName} <${msg.to}>` : msg.to}`,
    `Subject: ${msg.subject}`,
    "MIME-Version: 1.0",
  ];
  if (msg.unsubscribeUrl) {
    cabeceras.push(`List-Unsubscribe: <${msg.unsubscribeUrl}>`);
    cabeceras.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  cabeceras.push(`Content-Type: multipart/alternative; boundary="${limite}"`);

  return [
    cabeceras.join("\r\n"),
    "",
    `--${limite}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(msg.text),
    "",
    `--${limite}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(msg.html),
    "",
    `--${limite}--`,
    "",
  ].join("\r\n");
}

export function createFileDriver(dir = emailDevDir()): EmailDriver {
  return {
    name: "file",
    async send(msg: EmailMessage): Promise<SendResult> {
      try {
        await mkdir(dir, { recursive: true });
        const archivo = path.join(dir, nombreArchivo(msg));
        await writeFile(archivo, buildEml(msg), "utf8");
        return { ok: true, providerId: `file:${path.basename(archivo)}` };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "no se pudo escribir el correo",
          permanent: false,
        };
      }
    },
  };
}
