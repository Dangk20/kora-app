// El Caddyfile, leído como texto: estructura de sitios y llaves.
//
// Existe por el incidente del 10 oct 2026: al añadir el bloque de
// `legal.korashopp.com`, un reemplazo por texto buscó `korashopp.com {` y
// encontró primero `www.korashopp.com {`. El archivo quedó con
// `www.# CENTRO LEGAL…`, Caddy no lo aceptó, entró en bucle de reinicios y la
// tienda entera dejó de responder. Nada del CI lee este archivo, así que el
// error llegó intacto al servidor. Esto no sustituye a `caddy adapt`, pero
// atrapa la clase de error que lo provocó: sitios partidos y llaves sin
// cerrar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const caddyfile = readFileSync(join(process.cwd(), "deploy/Caddyfile"), "utf8");

/** Las líneas de nivel superior que abren un bloque, sin comentarios. */
function sitiosDeNivelSuperior(): string[] {
  const sitios: string[] = [];
  let profundidad = 0;
  for (const cruda of caddyfile.split("\n")) {
    const linea = cruda.replace(/#.*$/, "").trimEnd();
    if (profundidad === 0 && linea.endsWith("{") && linea.trim() !== "{") sitios.push(linea.trim());
    for (const c of linea) {
      if (c === "{") profundidad++;
      if (c === "}") profundidad--;
    }
  }
  return sitios;
}

describe("Caddyfile del borde", () => {
  it("las llaves cierran (fuera de comentarios)", () => {
    let profundidad = 0;
    for (const cruda of caddyfile.split("\n")) {
      for (const c of cruda.replace(/#.*$/, "")) {
        if (c === "{") profundidad++;
        if (c === "}") profundidad--;
        expect(profundidad).toBeGreaterThanOrEqual(0);
      }
    }
    expect(profundidad).toBe(0);
  });

  it("cada sitio de nivel superior es una dirección completa seguida de su llave", () => {
    for (const sitio of sitiosDeNivelSuperior()) {
      expect(sitio, sitio).toMatch(/^(\([a-z-]+\)|[a-z0-9.-]+\.[a-z]{2,}) \{$/);
    }
  });

  it("están los cuatro dominios, cada uno una sola vez", () => {
    const sitios = sitiosDeNivelSuperior();
    for (const host of ["test.korashopp.com", "www.korashopp.com", "legal.korashopp.com", "korashopp.com"]) {
      expect(sitios.filter((s) => s === `${host} {`), host).toHaveLength(1);
    }
  });

  it("www sigue redirigiendo al apex y legal va a la app de producción", () => {
    const bloque = (host: string) => caddyfile.split(`\n${host} {\n`)[1]?.split("\n}\n")[0] ?? "";
    expect(bloque("www.korashopp.com")).toContain("redir https://korashopp.com{uri} permanent");
    expect(bloque("legal.korashopp.com")).toContain("reverse_proxy kora-prod-app:3000");
  });
});
