// La imagen de Docker y `sharp`.
//
// **Por qué existe esta prueba.** `sharp` no llega a la imagen por el rastreo
// de archivos de Next —es estático y sharp carga sus piezas con requires
// dinámicos— sino instalado aparte en la etapa `sharpdeps`. Esa etapa fija la
// versión A MANO, y una discrepancia con `package.json` no daría ningún error:
// la tienda respondería 200 y solo reventaría la pantalla que procesa fotos.
//
// Costó tres despliegues descubrirlo, porque en macOS nunca se ve: ahí `sharp`
// está completo con su propio binario.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const leer = (p: string) => readFile(p, "utf8");

describe("sharp en la imagen de producción", () => {
  it("la versión del Dockerfile es la misma que la de package.json", async () => {
    const [dockerfile, pkg] = await Promise.all([leer("Dockerfile"), leer("package.json")]);

    const enImagen = dockerfile.match(/ARG SHARP_VERSION=([\d.]+)/)?.[1];
    const declarada = JSON.parse(pkg).dependencies?.sharp?.replace(/^[\^~]/, "");

    expect(enImagen).toBeDefined();
    expect(enImagen).toBe(declarada);
  });

  it("el build FALLA si sharp no se puede cargar", async () => {
    // La comprobación va en el build y no en el arranque: un contenedor que
    // arranca sano y muere al subir la primera foto convierte un error de
    // empaquetado en un incidente delante del operador.
    const dockerfile = await leer("Dockerfile");
    expect(dockerfile).toMatch(/RUN node -e .*require\('sharp'\)/);
  });

  it("sharp viaja autocontenido: sus dependencias van anidadas", async () => {
    // Copiando solo `sharp` y `@img` faltaba `detect-libc`. Anidarlo todo en
    // `sharp/node_modules/` hace imposible que se quede una pieza fuera, y
    // evita pisar versiones del node_modules podado de Next.
    const dockerfile = await leer("Dockerfile");
    expect(dockerfile).toMatch(/mkdir -p node_modules\/sharp\/node_modules/);
    // Una sola copia, la del paquete entero.
    const copias = dockerfile.match(/COPY --from=sharpdeps/g) ?? [];
    expect(copias).toHaveLength(1);
  });

  it("ya NO se intenta resolver por rastreo de archivos", async () => {
    // `outputFileTracingIncludes` no basta y perseguir globs no termina: cada
    // uno destapaba la siguiente pieza que falta, a un despliegue por intento.
    const config = await leer("next.config.ts");
    // La clave activa, no la palabra: el comentario que explica por qué se
    // quitó tiene que poder nombrarla.
    expect(config).not.toMatch(/^\s*outputFileTracingIncludes\s*:/m);
  });
});
