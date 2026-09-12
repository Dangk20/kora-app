// El contenido de una campaña por bloques.
// Ver openspec/changes/constructor-de-campanas — specs/email-campaigns.
import { describe, expect, it } from "vitest";
import {
  blocksFromLegacy,
  blocksToText,
  deriveLegacyFields,
  newBlock,
  parseBlocks,
  validateBlocks,
  type Block,
} from "@/modules/campaigns/blocks";
import { renderCampaign } from "@/modules/email/template";

const titulo = (text: string): Block => ({ ...newBlock("title"), text } as Block);
const texto = (text: string): Block => ({ ...newBlock("text"), text } as Block);
const boton = (label: string, url: string): Block => ({ ...newBlock("button"), label, url } as Block);

describe("validación", () => {
  it("una campaña sin ningún bloque con contenido no se guarda", () => {
    expect(validateBlocks([])).toHaveLength(1);
    expect(validateBlocks([newBlock("divider"), newBlock("spacer")])[0].message).toContain("al menos un bloque");
  });

  it("un botón con texto y sin enlace, o con enlace sin http, se rechaza", () => {
    expect(validateBlocks([titulo("Hola"), boton("Ver", "")])[0].message).toContain("enlace");
    expect(validateBlocks([titulo("Hola"), boton("Ver", "korashopp.com")])[0].message).toContain("http");
    expect(validateBlocks([titulo("Hola"), boton("Ver", "https://korashopp.com")])).toHaveLength(0);
  });
});

describe("los campos fijos se derivan de los bloques", () => {
  it("título = primer título; texto = textos unidos; botón = el primero con enlace", () => {
    const d = deriveLegacyFields([
      texto("Primero"),
      titulo("Titular"),
      texto("Segundo"),
      boton("Sin enlace", ""),
      boton("Ver", "https://korashopp.com"),
    ]);
    expect(d.title).toBe("Titular");
    expect(d.body).toBe("Primero\n\nSegundo");
    expect(d.ctaLabel).toBe("Ver");
    expect(d.ctaUrl).toBe("https://korashopp.com");
  });
});

describe("una campaña anterior a los bloques", () => {
  it("se convierte a bloques equivalentes, en el orden de la plantilla vieja", () => {
    const b = blocksFromLegacy({
      title: "Promo",
      body: "Hola\n\nAdiós",
      imageKey: "img/1.jpg",
      ctaLabel: "Ver",
      ctaUrl: "https://korashopp.com",
      productIds: ["p1", "p2"],
    });
    expect(b.map((x) => x.type)).toEqual(["image", "title", "text", "button", "products"]);
    // ida y vuelta: lo que se derive de los bloques es lo que había
    const d = deriveLegacyFields(b);
    expect(d.title).toBe("Promo");
    expect(d.body).toBe("Hola\n\nAdiós");
    expect(d.productIds).toEqual(["p1", "p2"]);
    expect(d.imageKey).toBe("img/1.jpg");
  });
});

describe("lo guardado en la base se lee sin confiar en su forma", () => {
  it("descarta bloques desconocidos y normaliza los conocidos", () => {
    const b = parseBlocks([
      { type: "title", text: "Hola" },
      { type: "video", url: "x" },
      { type: "spacer", height: 999 },
      { type: "products", productIds: ["a", 3, null] },
      "basura",
    ]);
    expect(b!.map((x) => x.type)).toEqual(["title", "spacer", "products"]);
    expect((b![1] as Extract<Block, { type: "spacer" }>).height).toBe(32);
    expect((b![2] as Extract<Block, { type: "products" }>).productIds).toEqual(["a"]);
  });
  it("null si no es una lista", () => {
    expect(parseBlocks(null)).toBeNull();
    expect(parseBlocks({ type: "title" })).toBeNull();
  });
});

describe("el correo con bloques", () => {
  const base = {
    subject: "Asunto",
    title: "",
    body: "",
    products: [],
    unsubscribeUrl: "https://korashopp.com/baja",
    storeBase: "https://korashopp.com",
  };

  it("dibuja los bloques en orden, con cabecera y pie legal alrededor", () => {
    const { html, text } = renderCampaign({
      ...base,
      blocks: [
        { type: "title", text: "Titular" },
        { type: "text", text: "Párrafo" },
        { type: "divider" },
        { type: "button", label: "Ver", url: "https://korashopp.com/catalogo" },
      ],
    });
    const iT = html.indexOf("Titular");
    const iP = html.indexOf("Párrafo");
    const iB = html.indexOf("Ver</a>");
    expect(iT).toBeGreaterThan(-1);
    expect(iT).toBeLessThan(iP);
    expect(iP).toBeLessThan(iB);
    // lo que no es bloque sigue estando
    expect(html).toContain("Cancelar suscripción");
    expect(html).toContain(">KORA<");
    expect(text).toContain("TITULAR");
    expect(text).toContain("Ver: https://korashopp.com/catalogo");
  });

  it("con bloques, los campos fijos no se dibujan (o saldrían dos veces)", () => {
    const { html } = renderCampaign({
      ...base,
      title: "TituloViejo",
      body: "CuerpoViejo",
      ctaLabel: "BotonViejo",
      ctaUrl: "https://x",
      blocks: [{ type: "title", text: "Nuevo" }],
    });
    expect(html).toContain("Nuevo");
    expect(html).not.toContain("TituloViejo");
    expect(html).not.toContain("CuerpoViejo");
    expect(html).not.toContain("BotonViejo");
  });

  it("el texto de un bloque se escapa: nada de HTML del operador", () => {
    const { html } = renderCampaign({ ...base, blocks: [{ type: "text", text: "<script>x</script>" }] });
    expect(html).not.toContain("<script>");
  });

  it("la versión de texto sale de los bloques", () => {
    expect(blocksToText([titulo("Hola"), texto("Mundo"), boton("Ir", "https://a.co")])).toBe("HOLA\n\nMundo\n\nIr: https://a.co");
  });
});
