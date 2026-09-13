// Departamento/estado → ciudad, con catálogos oficiales cerrados.
// Ver src/modules/geo/places.
import { describe, expect, it } from "vitest";
import { CITIES_US, MUNICIPIOS_CO, ciudadCanonica, ciudadesDe, listaCerrada } from "@/modules/geo/places";
import { DEPARTAMENTOS_CO, US_STATES } from "@/modules/orders/geo";

describe("Colombia (DIVIPOLA del DANE)", () => {
  it("todo departamento del selector tiene municipios, y viceversa", () => {
    for (const d of DEPARTAMENTOS_CO) expect(MUNICIPIOS_CO[d]?.length, d).toBeGreaterThan(0);
    for (const d of Object.keys(MUNICIPIOS_CO)) expect(DEPARTAMENTOS_CO).toContain(d);
  });
  it("son los 1.122 municipios, con la capital primera", () => {
    expect(Object.values(MUNICIPIOS_CO).reduce((n, l) => n + l.length, 0)).toBe(1122);
    expect(MUNICIPIOS_CO["Huila"][0]).toBe("Neiva");
    expect(MUNICIPIOS_CO["Antioquia"][0]).toBe("Medellín");
    expect(MUNICIPIOS_CO["Bogotá D.C."]).toEqual(["Bogotá D.C."]);
  });
  it("la lista es cerrada", () => {
    expect(listaCerrada("CO")).toBe(true);
  });
});

describe("Estados Unidos (Gazetteer del Census)", () => {
  it("todo estado del selector tiene lugares", () => {
    for (const s of US_STATES) expect(CITIES_US[s.code]?.length, s.name).toBeGreaterThan(0);
  });
  it("acepta el estado por nombre o por código: los pedidos guardan el nombre", () => {
    expect(ciudadesDe("US", "Florida")).toBe(ciudadesDe("US", "FL"));
    expect(ciudadesDe("US", "Florida")).toContain("Miami");
  });
  it("incluye los CDP: donde vive gente aunque no tenga alcalde", () => {
    // Kendall y The Villages no están incorporados; sin CDP no existirían.
    expect(CITIES_US.FL).toContain("Kendall");
    expect(CITIES_US.FL).toContain("The Villages");
  });
  it("sin sufijos de tipo: el comprador escribe Miami, no 'Miami city'", () => {
    for (const lista of Object.values(CITIES_US)) {
      for (const c of lista) expect(c).not.toMatch(/\s(city|town|village|CDP|borough)$/);
    }
  });
  it("la lista es cerrada también aquí", () => {
    expect(listaCerrada("US")).toBe(true);
  });
});

describe("la ciudad tiene que ser de su división", () => {
  it("devuelve el nombre canónico sin distinguir mayúsculas ni tildes", () => {
    expect(ciudadCanonica("CO", "Huila", "NEIVA")).toBe("Neiva");
    expect(ciudadCanonica("CO", "Bogotá D.C.", "bogota d.c.")).toBe("Bogotá D.C.");
    expect(ciudadCanonica("US", "Florida", "miami")).toBe("Miami");
    expect(ciudadCanonica("US", "Florida", "Saint Petersburg")).toBe("St. Petersburg");
  });
  it("rechaza una ciudad que no pertenece: 'Amazonas / Bogotá' es un paquete perdido", () => {
    expect(ciudadCanonica("CO", "Amazonas", "Bogotá")).toBeNull();
    expect(ciudadCanonica("CO", "Cundinamarca", "Bogotá")).toBeNull();
    expect(ciudadCanonica("US", "Wyoming", "Miami")).toBeNull();
  });
});
