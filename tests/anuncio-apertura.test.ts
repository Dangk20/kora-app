import { describe, expect, it } from "vitest";
import { ANUNCIO_HASTA, anuncioVigente } from "@/modules/storefront/announcement/config";

describe("anuncio de la gran apertura", () => {
  it("se muestra antes del evento a quien no lo ha visto", () => {
    expect(anuncioVigente(Date.parse("2026-10-28T15:00:00Z"), false)).toBe(true);
  });
  it("no se repite a quien ya lo cerró", () => {
    expect(anuncioVigente(Date.parse("2026-10-28T15:00:00Z"), true)).toBe(false);
  });
  it("se muestra todo el 7 nov en Colombia y caduca el 8", () => {
    expect(anuncioVigente(Date.parse("2026-11-07T23:59:00-05:00"), false)).toBe(true);
    expect(anuncioVigente(ANUNCIO_HASTA, false)).toBe(false);
    expect(anuncioVigente(Date.parse("2026-11-08T09:00:00-05:00"), false)).toBe(false);
  });
});
