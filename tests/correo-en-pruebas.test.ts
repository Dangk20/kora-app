// Correo real fuera de producción, solo a quien se ha permitido.
// Ver openspec/changes/correo-real-en-pruebas — specs/email-delivery.
//
// La base de pruebas tiene direcciones de personas reales, porque quien prueba
// un pedido escribe la suya. Sin esta lista no habría término medio entre
// "nada sale" y "todo sale" — y el segundo estado es una fuga esperando una
// campaña de demostración.
import { emailAllowlistTodos } from "@/modules/email/config";
import { describe, expect, it } from "vitest";
import {
  assertEmailConfigured,
  emailAllowlist,
  EmailAllowlistError,
} from "@/modules/email/config";
import { createAllowlistDriver } from "@/modules/email";
import type { EmailDriver, EmailMessage } from "@/modules/email/driver";

function espia(name: string): EmailDriver & { enviados: string[] } {
  const enviados: string[] = [];
  return {
    name,
    enviados,
    async send(msg: EmailMessage) {
      enviados.push(msg.to);
      return { ok: true, providerId: `${name}:${enviados.length}` };
    },
  };
}

const correo = (to: string): EmailMessage => ({ to, subject: "x", html: "<p>x</p>", text: "x" });

describe("la lista de destinatarios permitidos", () => {
  it("se lee separada por comas, sin espacios y en minúsculas", () => {
    const lista = emailAllowlist({
      NODE_ENV: "test",
      KORA_EMAIL_ALLOWLIST: " Daniel@Ejemplo.com, cliente@ejemplo.com ,,",
    } as NodeJS.ProcessEnv);
    expect([...lista]).toEqual(["daniel@ejemplo.com", "cliente@ejemplo.com"]);
  });

  it("vacía si no está definida", () => {
    expect(emailAllowlist({ NODE_ENV: "test" } as NodeJS.ProcessEnv).size).toBe(0);
  });
});

describe("el comodín `*` abre pruebas a cualquier destinatario", () => {
  const proveedor = { RESEND_API_KEY: "re_x", EMAIL_FROM: "KORA <a@b.co>" };
  // Pruebas de aceptación del cliente (13 sep 2026): cada persona prueba con
  // su propio correo, y no se puede ir añadiendo direcciones una a una.
  it("solo el asterisco exacto cuenta como 'todos'", () => {
    expect(emailAllowlistTodos({ NODE_ENV: "test", KORA_EMAIL_ALLOWLIST: "*" } as NodeJS.ProcessEnv)).toBe(true);
    expect(emailAllowlistTodos({ NODE_ENV: "test", KORA_EMAIL_ALLOWLIST: " * " } as NodeJS.ProcessEnv)).toBe(true);
    expect(emailAllowlistTodos({ NODE_ENV: "test", KORA_EMAIL_ALLOWLIST: "*,a@b.co" } as NodeJS.ProcessEnv)).toBe(false);
    expect(emailAllowlistTodos({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("sigue siendo una decisión en voz alta: con proveedor y sin variable, pruebas no arranca", () => {
    const env = { NODE_ENV: "production", KORA_ENV: "staging", ...proveedor } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).toThrow(EmailAllowlistError);
    expect(() => assertEmailConfigured({ ...env, KORA_EMAIL_ALLOWLIST: "*" })).not.toThrow();
  });

  it("🔒 en PRODUCCIÓN el comodín se rechaza como cualquier lista", () => {
    const env = { NODE_ENV: "production", KORA_EMAIL_ALLOWLIST: "*", ...proveedor } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).toThrow(EmailAllowlistError);
  });
});

describe("el driver compuesto", () => {
  it("a un permitido le entrega el proveedor; al resto, el disco", async () => {
    const real = espia("real");
    const disco = espia("disco");
    const driver = createAllowlistDriver(new Set(["daniel@ejemplo.com"]), real, disco);

    await driver.send(correo("daniel@ejemplo.com"));
    await driver.send(correo("persona-real@gmail.com"));

    expect(real.enviados).toEqual(["daniel@ejemplo.com"]);
    expect(disco.enviados).toEqual(["persona-real@gmail.com"]);
  });

  it("no distingue mayúsculas ni espacios en el destinatario", async () => {
    const real = espia("real");
    const disco = espia("disco");
    const driver = createAllowlistDriver(new Set(["daniel@ejemplo.com"]), real, disco);
    await driver.send(correo("  Daniel@Ejemplo.COM "));
    expect(real.enviados).toHaveLength(1);
    expect(disco.enviados).toHaveLength(0);
  });

  it("los dos caminos reportan el envío como correcto", async () => {
    const driver = createAllowlistDriver(new Set(["a@b.co"]), espia("real"), espia("disco"));
    expect((await driver.send(correo("a@b.co"))).ok).toBe(true);
    expect((await driver.send(correo("otro@b.co"))).ok).toBe(true);
  });
});

describe("las guardas de arranque", () => {
  const proveedor = { RESEND_API_KEY: "re_x", EMAIL_FROM: "KORA <a@b.co>" };

  it("PRUEBAS CON PROVEEDOR Y SIN LISTA NO ARRANCA", () => {
    // Es exactamente la fuga que se quiere impedir. La configuración
    // incompleta nunca se resuelve sola hacia el lado peligroso.
    const env = { NODE_ENV: "production", KORA_ENV: "staging", ...proveedor } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).toThrow(EmailAllowlistError);
    expect(() => assertEmailConfigured(env)).toThrow("KORA_EMAIL_ALLOWLIST");
  });

  it("desarrollo con proveedor y sin lista tampoco", () => {
    const env = { NODE_ENV: "development", ...proveedor } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).toThrow(EmailAllowlistError);
  });

  it("pruebas con proveedor y lista arranca", () => {
    const env = {
      NODE_ENV: "production",
      KORA_ENV: "staging",
      KORA_EMAIL_ALLOWLIST: "daniel@ejemplo.com",
      ...proveedor,
    } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).not.toThrow();
  });

  it("pruebas sin proveedor arranca, con o sin lista", () => {
    const base = { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(base)).not.toThrow();
    expect(() =>
      assertEmailConfigured({ ...base, KORA_EMAIL_ALLOWLIST: "a@b.co" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("PRODUCCIÓN CON LISTA NO ARRANCA", () => {
    // Una lista olvidada ahí dejaría a los compradores sin sus correos sin
    // producir ningún error: irían a disco dentro del contenedor.
    const env = {
      NODE_ENV: "production",
      KORA_EMAIL_ALLOWLIST: "daniel@ejemplo.com",
      ...proveedor,
    } as NodeJS.ProcessEnv;
    expect(() => assertEmailConfigured(env)).toThrow(EmailAllowlistError);
    expect(() => assertEmailConfigured(env)).toThrow("PRODUCCIÓN");
  });

  it("producción con proveedor y sin lista sigue arrancando", () => {
    expect(() =>
      assertEmailConfigured({ NODE_ENV: "production", ...proveedor } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});

describe("el candado del marketing dice lo que falta HOY", () => {
  it("ya no culpa al proveedor ni a los registros DNS, resueltos el 28 ago 2026", async () => {
    const { MARKETING_LOCK_REASON } = await import("@/modules/campaigns/lock");
    expect(MARKETING_LOCK_REASON).not.toMatch(/SPF|DKIM|DMARC/);
    expect(MARKETING_LOCK_REASON).not.toContain("Falta la cuenta");
    expect(MARKETING_LOCK_REASON).toContain("decisión");
  });
});
