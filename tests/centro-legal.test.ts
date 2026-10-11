// Centro legal en su subdominio (change `centro-legal`): dirección pública,
// enrutado por host y redirección de los enlaces antiguos. Todo puro: sin
// Next ni base.
import { describe, expect, it } from "vitest";
import { enrutarLegal } from "@/modules/legal/routing";
import { esHostLegal, legalHref, legalUrl } from "@/modules/legal/url";
import { redesSociales } from "@/modules/storefront/footer/social";

const CON_SUBDOMINIO = { KORA_LEGAL_URL: "https://legal.korashopp.com" } as unknown as NodeJS.ProcessEnv;
const SIN_SUBDOMINIO = {} as unknown as NodeJS.ProcessEnv;

describe("legalUrl — una sola definición de la dirección pública", () => {
  it("con subdominio, apunta a legal.korashopp.com", () => {
    expect(legalUrl("en", "terminos", { env: CON_SUBDOMINIO })).toBe("https://legal.korashopp.com/en/terminos");
    expect(legalUrl("es", undefined, { env: CON_SUBDOMINIO })).toBe("https://legal.korashopp.com/es");
  });

  it("sin subdominio (desarrollo, pruebas), se sirve bajo /legal del host de la tienda", () => {
    expect(legalUrl("es", "cambios", { env: SIN_SUBDOMINIO })).toBe("/legal/es/cambios");
    // Los correos necesitan una URL absoluta.
    expect(legalUrl("es", "datos-personales", { env: SIN_SUBDOMINIO, storeBase: "https://korashopp.com" })).toBe(
      "https://korashopp.com/legal/es/datos-personales",
    );
  });

  it("una barra final en la variable no duplica la barra", () => {
    expect(legalUrl("es", "envios", { env: { KORA_LEGAL_URL: "https://legal.korashopp.com/" } as unknown as NodeJS.ProcessEnv })).toBe(
      "https://legal.korashopp.com/es/envios",
    );
  });

  it("los enlaces internos del centro no llevan /legal en el subdominio", () => {
    expect(legalHref(true, "en", "comercio")).toBe("/en/comercio");
    expect(legalHref(false, "en", "comercio")).toBe("/legal/en/comercio");
  });

  it("solo el host configurado es el host legal", () => {
    expect(esHostLegal("legal.korashopp.com", CON_SUBDOMINIO)).toBe(true);
    expect(esHostLegal("korashopp.com", CON_SUBDOMINIO)).toBe(false);
    expect(esHostLegal("legal.korashopp.com", SIN_SUBDOMINIO)).toBe(false);
  });
});

describe("enrutado por host", () => {
  const legal = (path: string) => enrutarLegal("legal.korashopp.com", path, CON_SUBDOMINIO);
  const tienda = (path: string, env = CON_SUBDOMINIO) => enrutarLegal("korashopp.com", path, env);

  it("el subdominio sirve el centro legal desde la ruta interna", () => {
    expect(legal("/es/terminos")).toEqual({ tipo: "reescribir", ruta: "/legal/es/terminos" });
    expect(legal("/")).toEqual({ tipo: "reescribir", ruta: "/legal" });
  });

  it("el subdominio nunca sirve la tienda ni el panel: caen en el 404 del centro", () => {
    // `/legal/catalogo` y `/legal/admin` no son un idioma: la página responde 404.
    expect(legal("/catalogo")).toEqual({ tipo: "reescribir", ruta: "/legal/catalogo" });
    expect(legal("/admin")).toEqual({ tipo: "reescribir", ruta: "/legal/admin" });
  });

  it("los archivos estáticos pasan tal cual (logotipos, marcas, recursos de Next)", () => {
    for (const p of ["/logo-kora.png", "/marcas/visa.svg", "/_next/static/x.js", "/robots.txt"]) {
      expect(legal(p)).toEqual({ tipo: "seguir" });
    }
  });

  it("la ruta interna escrita en el subdominio se limpia", () => {
    expect(legal("/legal/es/terminos")).toEqual({ tipo: "redirigir", destino: "/es/terminos" });
  });

  it("un enlace antiguo de la tienda va al documento en español del subdominio", () => {
    expect(tienda("/legal/cambios")).toEqual({ tipo: "redirigir", destino: "https://legal.korashopp.com/es/cambios" });
    expect(tienda("/legal/datos-personales/")).toEqual({
      tipo: "redirigir",
      destino: "https://legal.korashopp.com/es/datos-personales",
    });
  });

  it("con subdominio, ninguna página legal queda viva en el host de la tienda", () => {
    expect(tienda("/legal/en/envios")).toEqual({ tipo: "redirigir", destino: "https://legal.korashopp.com/en/envios" });
    expect(tienda("/legal")).toEqual({ tipo: "redirigir", destino: "https://legal.korashopp.com/" });
  });

  it("sin subdominio, el enlace antiguo va a /legal/es/<slug> y el resto se sirve en la tienda", () => {
    expect(tienda("/legal/terminos", SIN_SUBDOMINIO)).toEqual({ tipo: "redirigir", destino: "/legal/es/terminos" });
    expect(tienda("/legal/es/terminos", SIN_SUBDOMINIO)).toEqual({ tipo: "seguir" });
  });

  it("el resto de la tienda no se toca", () => {
    for (const p of ["/", "/catalogo", "/admin", "/legales-falsa"]) {
      expect(tienda(p)).toEqual({ tipo: "seguir" });
    }
  });
});

describe("footer — redes sociales", () => {
  it("una red sin dirección no se muestra", () => {
    expect(redesSociales({} as unknown as NodeJS.ProcessEnv)).toEqual([]);
    expect(
      redesSociales({ KORA_SOCIAL_INSTAGRAM: "https://instagram.com/kora", KORA_SOCIAL_TIKTOK: " " } as unknown as NodeJS.ProcessEnv),
    ).toEqual([{ nombre: "Instagram", url: "https://instagram.com/kora" }]);
  });

  it("solo direcciones https", () => {
    expect(redesSociales({ KORA_SOCIAL_FACEBOOK: "javascript:alert(1)" } as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });
});
