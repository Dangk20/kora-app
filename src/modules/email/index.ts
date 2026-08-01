// Elección del driver de correo.
// Ver openspec/changes/email-marketing — design.md.
//
// Misma forma que el almacenamiento de imágenes: quien envía no sabe por dónde
// sale. Con proveedor configurado, sale por el proveedor; sin él, se escribe a
// disco. La guarda de arranque (`config.ts`) impide que "sin él" ocurra en
// producción.

import { emailProviderConfigured } from "./config";
import { createFileDriver } from "./file-driver";
import { createResendDriver } from "./resend-driver";
import type { EmailDriver } from "./driver";

let cache: EmailDriver | null = null;

export function emailDriver(env = process.env): EmailDriver {
  if (cache) return cache;
  cache = emailProviderConfigured(env)
    ? createResendDriver(env.RESEND_API_KEY!.trim(), env.EMAIL_FROM!.trim())
    : createFileDriver();
  return cache;
}

/** Solo para pruebas: olvida el driver elegido. */
export function _resetEmailDriver(): void {
  cache = null;
}

export { emailProviderConfigured } from "./config";
export type { EmailDriver, EmailMessage, SendResult } from "./driver";
