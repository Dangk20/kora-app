// Lo que la campaña de prueba enseñó en la reunión con el cliente (13 sep 2026).
//
//  1. Las fotos de los productos no llegaban: el almacenamiento en disco —el
//     de pruebas y producción— devuelve `/media/…`, una ruta relativa que en
//     un correo no resuelve contra nada. Gmail enseñaba el texto alternativo.
//  2. El correo de prueba y el envío real caían en EL MISMO hilo de Gmail,
//     titulado "[PRUEBA] …": Gmail agrupa por asunto e ignora las etiquetas
//     entre corchetes al comparar. Se separan con `X-Entity-Ref-ID`.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileDriver } from "@/modules/email/file-driver";
import { renderCampaign, srcAbsoluto } from "@/modules/email/template";

const carpetas: string[] = [];
afterEach(async () => {
  await Promise.all(carpetas.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const BASE = {
  subject: "Todo lo que le gusta a tu amor",
  title: "Todo lo que le gusta a tu amor",
  body: "Cuerpo",
  unsubscribeUrl: "https://korashopp.com/suscripcion/baja?t=abc",
  storeBase: "https://test.korashopp.com",
};

describe("toda imagen del correo lleva dirección absoluta", () => {
  it("una ruta relativa del disco se completa con la tienda; una absoluta no se toca", () => {
    expect(srcAbsoluto("/media/productos/a.jpg", "https://test.korashopp.com")).toBe(
      "https://test.korashopp.com/media/productos/a.jpg",
    );
    expect(srcAbsoluto("https://cdn.ejemplo.com/a.jpg", "https://test.korashopp.com")).toBe(
      "https://cdn.ejemplo.com/a.jpg",
    );
  });

  it("los productos de la parrilla", () => {
    const { html } = renderCampaign({
      ...BASE,
      products: [
        {
          name: "Blusa café",
          url: "https://test.korashopp.com/producto/blusa",
          imageUrl: "/media/productos/blusa.jpg",
          price: null,
        },
      ],
    });
    expect(html).toContain('src="https://test.korashopp.com/media/productos/blusa.jpg"');
    expect(html).not.toContain('src="/media/');
  });

  it("el bloque de imagen y los productos del constructor por bloques", () => {
    const { html } = renderCampaign({
      ...BASE,
      products: [],
      blocks: [
        { type: "image", url: "/media/campanas/banner.jpg", alt: "", linkUrl: null },
        {
          type: "products",
          products: [
            {
              name: "Pantaloneta",
              url: "https://test.korashopp.com/producto/pantaloneta",
              imageUrl: "/media/productos/p.jpg",
              price: null,
            },
          ],
        },
      ],
    });
    expect(html).toContain('src="https://test.korashopp.com/media/campanas/banner.jpg"');
    expect(html).toContain('src="https://test.korashopp.com/media/productos/p.jpg"');
    expect(html).not.toContain('src="/media/');
  });

  it("el banner del camino de campos fijos", () => {
    const { html } = renderCampaign({ ...BASE, products: [], imageUrl: "/media/campanas/b.jpg" });
    expect(html).toContain('src="https://test.korashopp.com/media/campanas/b.jpg"');
  });
});

describe("la prueba y la campaña no comparten hilo", () => {
  it("el driver escribe la clave de conversación como cabecera", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "kora-hilo-"));
    carpetas.push(dir);
    const r = await createFileDriver(dir).send({
      to: "ana@ejemplo.com",
      subject: "[PRUEBA] Oferta",
      html: "<p>x</p>",
      text: "x",
      threadKey: "prueba:c1:1",
    });
    expect(r.ok).toBe(true);
    const [archivo] = await readdir(dir);
    const eml = await readFile(path.join(dir, archivo), "utf8");
    expect(eml).toContain("X-Entity-Ref-ID: prueba:c1:1");
  });

  it("el driver de producción manda la misma cabecera al proveedor", () => {
    const resend = readFileSync("src/modules/email/resend-driver.ts", "utf8");
    expect(resend).toContain('headers["X-Entity-Ref-ID"] = msg.threadKey');
  });

  it("la prueba lleva una clave propia por envío y la campaña la suya", () => {
    const acciones = readFileSync("src/modules/campaigns/actions.ts", "utf8");
    const envio = readFileSync("src/modules/campaigns/dispatch.ts", "utf8");
    expect(acciones).toMatch(/threadKey: `prueba:\$\{c\.id\}:\$\{Date\.now\(\)\}`/);
    expect(envio).toMatch(/threadKey: `campana:\$\{campaign\.id\}`/);
  });
});

describe("los bloques de productos seguidos se funden en una parrilla", () => {
  // Tres bloques de un producto salían como tres parrillas con la mitad vacía
  // (Daniel, 20 sep 2026). Fundidos, se llenan de a dos, de izquierda a derecha.
  const producto = (n: string) => ({ name: n, url: `https://test.korashopp.com/producto/${n}`, imageUrl: null, price: null });

  it("fundirProductos junta los consecutivos y respeta los separados por otro bloque", async () => {
    const { fundirProductos } = await import("@/modules/email/template");
    const r = fundirProductos([
      { type: "title", text: "Navidad" },
      { type: "products", products: [producto("a")] },
      { type: "products", products: [producto("b")] },
      { type: "products", products: [producto("c")] },
      { type: "divider" },
      { type: "products", products: [producto("d")] },
    ]);
    expect(r.map((b) => b.type)).toEqual(["title", "products", "divider", "products"]);
    expect(r[1]).toMatchObject({ products: [producto("a"), producto("b"), producto("c")] });
  });

  it("en el correo, tres bloques de uno dan UNA tabla con dos filas", () => {
    const { html } = renderCampaign({
      ...BASE,
      products: [],
      blocks: [
        { type: "products", products: [producto("a")] },
        { type: "products", products: [producto("b")] },
        { type: "products", products: [producto("c")] },
      ],
    });
    // Una sola parrilla (una tabla con margin:18px 0), con "a" y "b" en la
    // misma fila y "c" con su celda de relleno.
    expect(html.match(/<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">/g)).toHaveLength(1);
    expect(html.match(/<tr>/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/<td style="width:50%;"><\/td>/g)).toHaveLength(1);
  });
});
