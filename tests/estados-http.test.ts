// Que un "esto no existe" responda 404, y no 200.
//
// Una página que dice "este producto ya no está disponible" pero responde 200
// es un *soft 404*: el buscador la indexa. En KORA eso significa que cada
// producto que el operador despublique se queda en Google compitiendo con los
// que sí vende, y llevando al comprador a una página vacía.
//
// La causa fue un `loading.tsx` añadido a la ficha: activa streaming, las
// cabeceras salen ANTES de que la página consulte la base y descubra que el
// producto no existe, y para cuando llama a `notFound()` ya no se puede
// cambiar el estado. Se midió contra un build de producción real: 200 con el
// archivo, 404 sin él.
//
// Esta prueba no mide el estado —haría falta levantar un servidor— sino la
// causa: ninguna ruta que pueda no encontrar su contenido puede tener
// esqueleto de carga.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

function paginas(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) paginas(ruta, acc);
    else if (entrada === "page.tsx") acc.push(ruta);
  }
  return acc;
}

describe("páginas que pueden no encontrar su contenido", () => {
  it("ninguna tiene loading.tsx, que rompería su 404", () => {
    const raiz = join(process.cwd(), "src/app");

    const culpables = paginas(raiz)
      .filter((p) => /\bnotFound\(\)/.test(readFileSync(p, "utf8")))
      .filter((p) => existsSync(join(dirname(p), "loading.tsx")))
      .map((p) => dirname(p).replace(`${process.cwd()}/`, ""));

    expect(culpables).toEqual([]);
  });

  it("hay al menos una página que llama a notFound(), o esto no comprueba nada", () => {
    // Sin esta guarda, borrar todos los notFound() dejaría la prueba en verde
    // por vacío y nadie lo notaría.
    const raiz = join(process.cwd(), "src/app");
    const conNotFound = paginas(raiz).filter((p) =>
      /\bnotFound\(\)/.test(readFileSync(p, "utf8")),
    );

    expect(conNotFound.length).toBeGreaterThan(0);
  });

  it("la pantalla de no encontrado vive en la raíz de la aplicación", () => {
    // Un `not-found.tsx` anidado renderiza pero tampoco fija el estado.
    expect(existsSync(join(process.cwd(), "src/app/not-found.tsx"))).toBe(true);
  });
});
