// Las fotos de producto no se recortan.
//
// Estaba mal en DIEZ sitios y era invisible: `object-cover` recorta la imagen
// para llenar su hueco, y en un packshot —el producto entero sobre fondo
// claro, que es lo que va a subir el cliente— lo que recorta es el producto.
// Una licuadora alta pierde la jarra; un teclado ancho, las teclas de los
// extremos.
//
// No se veía porque el catálogo de demostración no tiene ni una foto. Se
// habría visto en todas las pantallas el día que llegue el catálogo real, que
// es el día de la entrega. Por eso esto es una prueba y no una nota.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Archivos donde `object-cover` es CORRECTO: los banners de Vitrina son artes
 * diseñadas para llenar su hueco, y ahí recortar los bordes es lo que se
 * espera. La lista es explícita para que añadir uno nuevo sea una decisión.
 */
const BANNERS = [
  "src/modules/storefront/banner-carousel.tsx",
  "src/app/admin/vitrina/banner-modal.tsx",
];

function tsx(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) tsx(ruta, acc);
    else if (entrada.endsWith(".tsx")) acc.push(ruta);
  }
  return acc;
}

describe("fotos de producto", () => {
  it("ninguna se encuadra con object-cover", () => {
    const raiz = process.cwd();
    const permitidos = new Set(BANNERS.map((p) => join(raiz, p)));

    const culpables = tsx(join(raiz, "src"))
      .filter((f) => !permitidos.has(f))
      .filter((f) => /className="[^"]*object-cover/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${raiz}/`, ""));

    expect(culpables).toEqual([]);
  });

  it("la lista de banners permitidos existe de verdad", () => {
    // Si un archivo se renombra, la excepción dejaría de aplicar en silencio y
    // la prueba pasaría por el motivo equivocado.
    for (const ruta of BANNERS) {
      expect(() => readFileSync(join(process.cwd(), ruta), "utf8")).not.toThrow();
    }
  });
});
