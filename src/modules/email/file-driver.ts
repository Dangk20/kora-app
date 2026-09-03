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
  return envolver(Buffer.from(texto, "utf8").toString("base64"));
}

function envolver(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n");
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
  const adjuntos = msg.attachments ?? [];
  // Con adjuntos, la estructura correcta es un `multipart/mixed` que contiene
  // el `multipart/alternative` con los dos cuerpos. Anidar así, y no colgar
  // todo del mismo nivel, es lo que hace que el cliente de correo siga
  // eligiendo entre texto y HTML en vez de enseñar los dos.
  const limiteExterior = `kora-mixed-${randomUUID()}`;
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
  cabeceras.push(
    adjuntos.length > 0
      ? `Content-Type: multipart/mixed; boundary="${limiteExterior}"`
      : `Content-Type: multipart/alternative; boundary="${limite}"`,
  );

  const alternativo = [
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
  ];

  if (adjuntos.length === 0) {
    return [cabeceras.join("\r\n"), "", ...alternativo, ""].join("\r\n");
  }

  const partes: string[] = [
    cabeceras.join("\r\n"),
    "",
    `--${limiteExterior}`,
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    ...alternativo,
    "",
  ];

  for (const a of adjuntos) {
    partes.push(
      `--${limiteExterior}`,
      `Content-Type: ${a.contentType}; name="${a.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${a.filename}"`,
      "",
      envolver(Buffer.from(a.content).toString("base64")),
      "",
    );
  }

  partes.push(`--${limiteExterior}--`, "");
  return partes.join("\r\n");
}

export function createFileDriver(dir = emailDevDir()): EmailDriver {
  return {
    name: "file",
    async send(msg: EmailMessage): Promise<SendResult> {
      try {
        await mkdir(dir, { recursive: true });
        const archivo = path.join(dir, nombreArchivo(msg));
        await writeFile(archivo, buildEml(msg), "utf8");

        // El adjunto se escribe TAMBIÉN suelto, al lado del `.eml`. Dentro del
        // correo va en base64, y eso no se revisa sin un cliente de correo
        // delante: es el mismo motivo por el que el correo se escribe entero
        // en vez de registrar que se envió. Un comprobante con un total mal
        // calculado se ve abriendo el PDF, no deduciéndolo.
        for (const a of msg.attachments ?? []) {
          const base = path.basename(archivo, ".eml");
          await writeFile(path.join(dir, `${base}__${a.filename}`), Buffer.from(a.content));
        }
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
