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

describe("los archivos de compose son YAML válido", () => {
  // El 12 sep 2026 un `volumes:` duplicado en el worker de pruebas tumbó el
  // despliegue: YAML no admite la clave dos veces y compose rechaza el archivo
  // ENTERO, con el error escondido en el paso de migración. El CI había pasado.
  it("ningún servicio repite una clave", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["deploy/docker-compose.staging.yml", "deploy/docker-compose.prod.yml", "deploy/docker-compose.edge.yml"]) {
      const texto = readFileSync(f, "utf8");
      // Dentro de cada servicio (bloques indentados a 2 espacios bajo `services:`),
      // una clave de nivel de servicio (4 espacios) no puede aparecer dos veces.
      const servicios = texto.split(/\n  (?=[a-z][\w-]*:\s*$)/m);
      for (const s of servicios) {
        const claves = [...s.matchAll(/^    ([a-z_]+):/gm)].map((m) => m[1]);
        const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i);
        expect(repetidas, `${f}: clave repetida en un servicio`).toEqual([]);
      }
    }
  });
});

describe("el worker tiene salida a internet", () => {
  // El 13 sep 2026 ningún correo de pedido llegó en pruebas: el worker —que es
  // quien envía— estaba SOLO en la red `interna` (`internal: true`, sin
  // internet), así que `api.resend.com` era inalcanzable, cada envío moría con
  // `fetch failed` y el evento quedaba muerto tras 5 intentos. En local nunca
  // se nota: el correo de desarrollo se escribe a disco y no necesita salir.
  it("staging y prod conectan el worker a una red con egreso", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["deploy/docker-compose.staging.yml", "deploy/docker-compose.prod.yml"]) {
      const texto = readFileSync(f, "utf8");
      const worker = texto.slice(texto.indexOf("\n  worker:\n"), texto.indexOf("\n  migrate:\n"));
      const redes = [...worker.matchAll(/^      - ([a-z]+)\s*$/gm)]
        .map((m) => m[1])
        .filter((r) => /^\s*networks:/m.test(worker) && ["interna", "salida", "frontera"].includes(r));
      expect(redes, `${f}: el worker necesita una red con salida a internet`).toContain("salida");
      // Y `salida` NO puede ser interna, o no sirve de nada.
      const declaracion = texto.slice(texto.indexOf("\n  salida:\n"));
      const bloque = declaracion.split(/\n  [a-z]+:\n/)[0];
      expect(bloque, `${f}: la red salida no puede ser internal`).not.toMatch(/internal:\s*true/);
    }
  });
});
