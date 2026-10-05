// Tienda en inglés (change `tienda-en-ingles`): el idioma sigue al mismo
// origen que la moneda, la elección manual manda, y el contenido sin traducir
// cae al español en vez de salir vacío.
import { describe, expect, it } from "vitest";
import { enIdioma, localeForOrigin, resolveLocale } from "@/modules/i18n";
import { MESSAGES } from "@/modules/i18n/messages";

describe("idioma del visitante", () => {
  it("desde el exterior, inglés; desde Colombia o sin saberlo, español", () => {
    expect(localeForOrigin("exterior")).toBe("en");
    expect(localeForOrigin("colombia")).toBe("es");
    expect(localeForOrigin("desconocido")).toBe("es");
  });

  it("la elección manual prevalece sobre la detección", () => {
    expect(resolveLocale("es", "exterior")).toBe("es");
    expect(resolveLocale("en", "colombia")).toBe("en");
    expect(resolveLocale("fr", "exterior")).toBe("en"); // valor basura = detección
  });
});

describe("contenido de catálogo", () => {
  it("en inglés usa la traducción y, sin ella, el español; nunca vacío", () => {
    expect(enIdioma("en", "Blusa", "Blouse")).toBe("Blouse");
    expect(enIdioma("en", "Blusa", null)).toBe("Blusa");
    expect(enIdioma("en", "Blusa", "   ")).toBe("Blusa");
    expect(enIdioma("es", "Blusa", "Blouse")).toBe("Blusa");
  });
});

describe("diccionarios", () => {
  it("inglés y español tienen exactamente las mismas claves", () => {
    const claves = (o: unknown, pre = ""): string[] =>
      o && typeof o === "object"
        ? Object.entries(o).flatMap(([k, v]) =>
            // `null` también es una clave: un texto que en un idioma no aplica
            // (p. ej. el aviso "solo en español", que en español sobra).
            v === null || typeof v === "function" || typeof v === "string"
              ? [pre + k]
              : claves(v, `${pre}${k}.`),
          )
        : [];
    expect(claves(MESSAGES.en).sort()).toEqual(claves(MESSAGES.es).sort());
  });
});
