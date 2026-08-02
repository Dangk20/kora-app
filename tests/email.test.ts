// Transporte de correo y plantilla de marca.
//   1. En desarrollo el correo se ESCRIBE y se puede leer; sin eso no habría
//      forma de trabajar el módulo sin cuenta de proveedor ni dominio.
//   2. En producción, sin proveedor configurado, la aplicación no arranca.
//   3. El pie legal siempre lleva sus tres elementos (Ley 1581 / CAN-SPAM).
//   4. Una audiencia mixta NUNCA muestra un precio: no existe tasa de cambio.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertEmailConfigured,
  EmailConfigError,
  emailProviderConfigured,
  missingEmailVars,
  requiereProveedor,
} from "@/modules/email/config";
import { buildEml, createFileDriver } from "@/modules/email/file-driver";
import {
  escapeHtml,
  renderCampaign,
  type TemplateProduct,
} from "@/modules/email/template";

const carpetas: string[] = [];
async function carpetaTemporal() {
  const d = await mkdtemp(path.join(tmpdir(), "kora-mail-"));
  carpetas.push(d);
  return d;
}
afterEach(async () => {
  await Promise.all(carpetas.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const BASE: Parameters<typeof renderCampaign>[0] = {
  subject: "Promoción de agosto",
  preheader: "Hasta 30 % en tecnología",
  title: "Lo nuevo de KORA",
  body: "Primer párrafo.\n\nSegundo párrafo.",
  products: [],
  unsubscribeUrl: "https://korashopp.com/suscripcion/baja?t=abc.def",
  storeBase: "https://korashopp.com",
};

const producto = (over: Partial<TemplateProduct> = {}): TemplateProduct => ({
  name: "Audífonos Ultra",
  url: "https://korashopp.com/producto/audifonos-ultra",
  imageUrl: null,
  price: null,
  ...over,
});

// ─────────────────────────────────────────────────────────────
describe("configuración del proveedor", () => {
  const sinProveedor = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const conProveedor = {
    NODE_ENV: "production",
    RESEND_API_KEY: "re_xxx",
    EMAIL_FROM: "KORA <hola@korashopp.com>",
  } as NodeJS.ProcessEnv;

  it("dice qué variables faltan", () => {
    expect(missingEmailVars(sinProveedor)).toEqual(["RESEND_API_KEY", "EMAIL_FROM"]);
    expect(missingEmailVars(conProveedor)).toEqual([]);
    expect(emailProviderConfigured(conProveedor)).toBe(true);
  });

  it("EN PRODUCCIÓN SIN PROVEEDOR, LA APLICACIÓN NO ARRANCA", () => {
    // Es la lección que ya costó una vez con las imágenes: una comprobación
    // perezosa deja el contenedor reportándose sano con el módulo roto.
    expect(() => assertEmailConfigured(sinProveedor)).toThrow(EmailConfigError);
    try {
      assertEmailConfigured(sinProveedor);
    } catch (e) {
      expect((e as Error).message).toContain("RESEND_API_KEY");
    }
  });

  it("en desarrollo arranca sin configurar nada", () => {
    expect(() => assertEmailConfigured({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("EN PRUEBAS ARRANCA SIN PROVEEDOR, y es a propósito", () => {
    // La imagen se compila una sola vez con NODE_ENV=production y se usa en
    // pruebas y en producción. Sin distinguirlas, esta guarda tumbaría también
    // el entorno de pruebas — donde además NO queremos que salga correo real:
    // staging le escribiría a direcciones de clientes de verdad mientras
    // alguien ensaya un pedido.
    const pruebas = { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv;
    expect(requiereProveedor(pruebas)).toBe(false);
    expect(() => assertEmailConfigured(pruebas)).not.toThrow();
  });

  it("SIN KORA_ENV se comporta como producción: la guarda protege por omisión", () => {
    // Si alguien monta un entorno nuevo y olvida definirlo, el fallo correcto
    // es no arrancar — no arrancar callado sin poder enviar.
    expect(requiereProveedor(sinProveedor)).toBe(true);
    expect(() => assertEmailConfigured(sinProveedor)).toThrow(EmailConfigError);
    // Y un valor cualquiera tampoco desactiva la guarda: solo "staging".
    const raro = { NODE_ENV: "production", KORA_ENV: "pruebas" } as NodeJS.ProcessEnv;
    expect(requiereProveedor(raro)).toBe(true);
  });

  it("con proveedor configurado, producción arranca", () => {
    expect(() => assertEmailConfigured(conProveedor)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe("driver de desarrollo", () => {
  it("ESCRIBE UN CORREO LEGIBLE, no un registro de que se envió", async () => {
    const dir = await carpetaTemporal();
    const driver = createFileDriver(dir);

    const r = await driver.send({
      to: "laura@ejemplo.com",
      toName: "Laura Gómez",
      subject: "Promoción de agosto",
      html: "<p>Hola</p>",
      text: "Hola",
      unsubscribeUrl: "https://korashopp.com/suscripcion/baja?t=abc",
    });

    expect(r.ok).toBe(true);
    const archivos = await readdir(dir);
    expect(archivos).toHaveLength(1);

    const eml = await readFile(path.join(dir, archivos[0]), "utf8");
    expect(eml).toContain("To: Laura Gómez <laura@ejemplo.com>");
    expect(eml).toContain("Subject: Promoción de agosto");
    // El encabezado que da el botón nativo de baja de Gmail/Outlook.
    expect(eml).toContain("List-Unsubscribe: <https://korashopp.com/suscripcion/baja?t=abc>");
    // Las dos versiones del cuerpo van dentro.
    expect(eml).toContain('Content-Type: text/plain; charset="utf-8"');
    expect(eml).toContain('Content-Type: text/html; charset="utf-8"');
    expect(Buffer.from(eml.split("\r\n\r\n").at(-2) ?? "", "base64").toString()).toContain("<p>Hola</p>");
  });

  it("un fallo al escribir se reporta como fallo, no como envío", async () => {
    // Ruta imposible = una carpeta DENTRO de un archivo. Da ENOTDIR al instante
    // en cualquier sistema, y se construye aquí en vez de depender de una ruta
    // del sistema.
    //
    // Antes se usaba `/proc/...`, y esa elección tumbó el CI: en macOS `/proc`
    // no existe y el error llega enseguida, pero en Linux existe, y `mkdir`
    // recursivo sobre procfs NO resuelve NI rechaza — se queda colgado. La
    // prueba pasaba en el portátil y agotaba el tiempo en el servidor, que es
    // la peor forma de fallar: parece un problema del CI y es del código.
    const base = await carpetaTemporal();
    const archivo = path.join(base, "esto-es-un-archivo");
    await writeFile(archivo, "no soy una carpeta");

    const driver = createFileDriver(path.join(archivo, "subcarpeta"));
    const r = await driver.send({ to: "x@y.com", subject: "s", html: "h", text: "t" });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });

  it("el correo va dirigido a UNA sola persona", () => {
    const eml = buildEml({ to: "uno@ejemplo.com", subject: "s", html: "h", text: "t" });
    const destinatarios = eml.split("\r\n").filter((l) => l.startsWith("To:"));
    expect(destinatarios).toHaveLength(1);
    expect(eml).not.toContain("Bcc:");
    expect(eml).not.toContain("Cc:");
  });
});

// ─────────────────────────────────────────────────────────────
describe("plantilla de marca", () => {
  it("el PIE LEGAL siempre lleva negocio, política de datos y baja", () => {
    const { html, text } = renderCampaign(BASE);
    for (const salida of [html, text]) {
      expect(salida).toContain("KORA");
      expect(salida).toContain("/politica-de-datos");
      expect(salida).toContain(BASE.unsubscribeUrl);
    }
  });

  it("siempre hay versión de texto plano con lo esencial", () => {
    const { text } = renderCampaign(BASE);
    expect(text).toContain("LO NUEVO DE KORA");
    expect(text).toContain("Primer párrafo.");
    expect(text).toContain("Segundo párrafo.");
    expect(text).not.toContain("<");
  });

  it("AUDIENCIA MIXTA: los productos van SIN precio", () => {
    // No existe tasa de cambio en KORA y es deliberado: un precio único para
    // dos países le estaría mintiendo a la mitad de la lista.
    const { html, text } = renderCampaign({ ...BASE, products: [producto({ price: null })] });
    expect(html).toContain("Ver precio en la tienda");
    expect(html).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/—\s*\$/);
  });

  it("audiencia de un país: precio en su moneda, con tachado solo si hay ahorro", () => {
    const conAhorro = renderCampaign({
      ...BASE,
      products: [producto({ price: { amount: 149900, currency: "COP", strikethrough: 189900 } })],
    });
    expect(conAhorro.html).toContain("line-through");

    const sinAhorro = renderCampaign({
      ...BASE,
      products: [producto({ price: { amount: 189900, currency: "COP", strikethrough: null } })],
    });
    expect(sinAhorro.html).not.toContain("line-through");
  });

  it("el preheader va oculto pero presente: decide si el correo se abre", () => {
    const { html } = renderCampaign(BASE);
    expect(html).toContain("Hasta 30 % en tecnología");
    expect(html).toContain("display:none");
  });

  it("saluda por el nombre cuando lo hay", () => {
    const { html, text } = renderCampaign({ ...BASE, recipientName: "Laura Gómez" });
    expect(html).toContain("Hola, Laura");
    expect(text).toContain("Hola, Laura");
  });

  it("ESCAPA lo que escribe el operador: el cuerpo es texto, no HTML", () => {
    const { html } = renderCampaign({
      ...BASE,
      title: '<script>alert("x")</script>',
      body: "Texto con <b>etiquetas</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;etiquetas&lt;/b&gt;");
    expect(escapeHtml('a"b<c>')).toBe("a&quot;b&lt;c&gt;");
  });

  it("el HTML es conservador: tablas y estilos en línea", () => {
    // Un cliente de correo no es un navegador: Outlook usa el motor de Word y
    // Gmail descarta la hoja de estilos.
    const { html } = renderCampaign(BASE);
    expect(html).toContain("<table");
    expect(html).toContain('style="');
    expect(html).not.toContain("<style");
    expect(html).not.toContain("flex");
  });
});
