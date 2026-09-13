// Elección del driver de correo.
// Ver openspec/changes/email-marketing — design.md.
//
// Misma forma que el almacenamiento de imágenes: quien envía no sabe por dónde
// sale. Con proveedor configurado, sale por el proveedor; sin él, se escribe a
// disco. La guarda de arranque (`config.ts`) impide que "sin él" ocurra en
// producción.

import { esProduccion } from "@/lib/environment";
import { emailAllowlist, emailAllowlistTodos, emailProviderConfigured } from "./config";
import { createFileDriver } from "./file-driver";
import { createResendDriver } from "./resend-driver";
import type { EmailDriver, EmailMessage, SendResult } from "./driver";

let cache: EmailDriver | null = null;

/**
 * Fuera de producción, el proveedor solo entrega a la lista permitida; el
 * resto va a disco. Es un driver aparte, y no una condición dentro del de
 * Resend, para que los dos drivers existentes no cambien y la regla viva en
 * un solo sitio que se prueba solo.
 */
export function createAllowlistDriver(
  permitidos: Set<string>,
  real: EmailDriver,
  disco: EmailDriver,
): EmailDriver {
  return {
    name: `allowlist(${real.name}|${disco.name})`,
    send(msg: EmailMessage): Promise<SendResult> {
      const destino = msg.to.trim().toLowerCase();
      return permitidos.has(destino) ? real.send(msg) : disco.send(msg);
    },
  };
}

/**
 * Anota cada correo que el proveedor ACEPTÓ. Es el contador de consumo del
 * plan, y va aquí —envolviendo al proveedor— y no en cada módulo, para que el
 * correo de prueba de campaña, que llama al driver directamente, cuente igual
 * que un pedido. Un fallo al anotar no convierte un envío correcto en fallido:
 * el correo ya salió.
 */
export function createAccountingDriver(
  real: EmailDriver,
  anotar: (r: { providerId: string; to: string; subject: string }) => Promise<void>,
): EmailDriver {
  return {
    name: `contable(${real.name})`,
    async send(msg: EmailMessage): Promise<SendResult> {
      const r = await real.send(msg);
      if (r.ok) {
        try {
          await anotar({ providerId: r.providerId, to: msg.to, subject: msg.subject });
        } catch (e) {
          console.error("[email] el correo salió pero no se pudo anotar el consumo:", e);
        }
      }
      return r;
    },
  };
}

async function anotarEnBase(r: { providerId: string; to: string; subject: string }) {
  const { db } = await import("@/lib/db");
  await db.providerSend.create({ data: r });
}

export function emailDriver(env = process.env): EmailDriver {
  if (cache) return cache;
  if (!emailProviderConfigured(env)) {
    cache = createFileDriver();
    return cache;
  }
  const real = createAccountingDriver(
    createResendDriver(env.RESEND_API_KEY!.trim(), env.EMAIL_FROM!.trim()),
    anotarEnBase,
  );
  // En producción la guarda de arranque ya impidió que exista una lista; aquí
  // no se vuelve a decidir. Fuera de producción, la guarda exigió que la haya.
  // Orden: lista → contable → proveedor. Lo que va a disco nunca se cuenta.
  cache =
    esProduccion(env) || emailAllowlistTodos(env)
      ? real
      : createAllowlistDriver(emailAllowlist(env), real, createFileDriver());
  return cache;
}

/** Solo para pruebas: olvida el driver elegido. */
export function _resetEmailDriver(): void {
  cache = null;
}

export { emailProviderConfigured } from "./config";
export type { EmailDriver, EmailMessage, SendResult } from "./driver";
