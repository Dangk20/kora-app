// Fija las dos correcciones de la auditoría de fidelidad (7 ago 2026) que
// contradecían reglas escritas del proyecto.
//
// Se comprueba sobre la fuente y no renderizando, porque estas pruebas corren
// en entorno `node` sin JSX. Es una comprobación tosca, y aun así habría
// atrapado los dos defectos: los dos consistían en que un archivo hacía algo
// que otro archivo del mismo repositorio decía que no se hacía.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_LABEL } from "@/modules/orders/status";
import { GUARANTEES } from "@/modules/storefront/guarantees";

const raiz = process.cwd();
const leer = (p: string) => readFileSync(join(raiz, p), "utf8");

/** Pantallas del panel que muestran el estado de un pedido. */
const PANTALLAS_CON_ESTADO = [
  "src/app/admin/page.tsx",
  "src/app/admin/pedidos/page.tsx",
  "src/app/admin/pedidos/[id]/page.tsx",
];

describe("el panel no filtra el enum de la base", () => {
  // El dashboard imprimía `{o.status}` — CONFIRMED, PREPARING — teniendo
  // STATUS_LABEL al lado y usándolo en las otras tres pantallas.
  /**
   * Quita comentarios antes de buscar.
   *
   * Sin esto, el propio comentario que documenta el defecto —que cita el
   * código malo entre comillas— hace fallar la prueba. Y una prueba que
   * prohíbe describir el error que previene es una prueba que se acaba
   * borrando.
   */
  const sinComentarios = (fuente: string) =>
    fuente
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it.each(PANTALLAS_CON_ESTADO)("%s traduce el estado", (ruta) => {
    const fuente = sinComentarios(leer(ruta));

    expect(fuente).toContain("STATUS_LABEL");
    // Renderizar la propiedad en crudo es el defecto exacto. El lookbehind
    // excluye `status={order.status}`, que es pasar un prop —legítimo— y no
    // pintar el enum en pantalla.
    expect(fuente).not.toMatch(/(?<![=\w])\{\s*\w+\.status\s*\}/);
  });

  it("ninguna pantalla del panel escribe a mano una etiqueta de estado", () => {
    // Una segunda tabla de etiquetas se desincroniza en cuanto se añada un
    // estado, y el síntoma sería que dos pantallas dicen cosas distintas del
    // mismo pedido.
    for (const ruta of PANTALLAS_CON_ESTADO) {
      const fuente = leer(ruta);
      for (const etiqueta of Object.values(STATUS_LABEL)) {
        expect(fuente).not.toContain(`"${etiqueta}"`);
      }
    }
  });
});

describe("la tarjeta de producto no vende desde el listado", () => {
  const tarjeta = () => leer("src/modules/storefront/product-card.tsx");

  it("no monta el botón de añadir al carrito", () => {
    // CLAUDE.md: "Las cards del catálogo no llevan botón: la compra se decide
    // en la ficha." El código lo incumplía.
    expect(tarjeta()).not.toContain("AddToCartButton");
  });

  it("no ofrece 'Agregar' ni 'Ver opciones'", () => {
    for (const texto of ["Agregar", "Ver opciones", "Elige una opción"]) {
      expect(tarjeta()).not.toContain(`>${texto}`);
      expect(tarjeta()).not.toContain(`"${texto}"`);
    }
  });

  it("el botón sigue existiendo para la ficha, que es donde se compra", () => {
    // Quitarlo de la tarjeta no debe haberlo dejado huérfano.
    const ficha = leer("src/app/(tienda)/producto/[slug]/product-detail.tsx");
    expect(ficha).toContain("Agregar al carrito");
    expect(ficha).toContain("Comprar ahora");
  });

  it("la regla de CLAUDE.md y el código dicen lo mismo", () => {
    expect(leer("CLAUDE.md")).toContain("no llevan botón");
  });
});

describe("las garantías publicadas son las que el negocio sostiene", () => {
  it("hay exactamente tres", () => {
    expect(GUARANTEES).toHaveLength(3);
  });

  it("ninguna promete algo que el negocio no sostiene", () => {
    // El prototipo promete compra protegida, envío gratis y devoluciones a 7
    // días. Se decidió no publicarlas; esta prueba impide que reentren por
    // copiar el prototipo.
    const texto = GUARANTEES.map((g) => `${g.title} ${g.text}`).join(" ").toLowerCase();

    for (const prohibida of [
      "envío gratis",
      "compra protegida",
      "devolucion",
      "7 días",
      "cuotas",
      "sin interés",
    ]) {
      expect(texto).not.toContain(prohibida);
    }
  });

  it("el home y la ficha las toman de la MISMA lista", () => {
    // Duplicarlas garantizaría que un cambio de promesa comercial quede
    // corregido en una pantalla y vivo en la otra — y la olvidada sería la de
    // la ficha, que se lee justo antes de comprar.
    expect(leer("src/modules/storefront/home-layout.tsx")).toContain(
      'from "./guarantees"',
    );
    expect(leer("src/app/(tienda)/producto/[slug]/product-detail.tsx")).toContain(
      "ProductGuarantees",
    );
  });
});

describe("el movimiento de la tarjeta al pasar el cursor", () => {
  // Tailwind 4 dejó de meter `-translate-y` y `scale` dentro de `transform`:
  // ahora usa las propiedades CSS `translate` y `scale` por separado. Una
  // lista arbitraria escrita como `transition-[transform,…]` deja fuera justo
  // lo que se mueve, y el desplazamiento ocurre DE GOLPE. No da error, se lee
  // correcto en el código, y ninguna curva ni duración lo arregla porque no
  // se están aplicando a nada. Pasó exactamente eso: la tarjeta saltaba sus
  // 8 px en un fotograma.
  const tarjeta = readFileSync("src/modules/storefront/product-card.tsx", "utf8");

  it("la lista de transiciones nombra `translate`, que es lo que se mueve", () => {
    expect(tarjeta).toContain("transition-[translate,box-shadow]");
    expect(tarjeta).toContain("transition-[opacity,translate]");
  });

  it("ninguna lista arbitraria dice `transform` mientras se usa translate", () => {
    // Sin las líneas de comentario: ahí SÍ se nombra la forma incorrecta,
    // justamente para explicar por qué no se usa.
    const codigo = tarjeta
      .split("\n")
      .filter((linea) => !linea.trim().startsWith("//"))
      .join("\n");
    expect(codigo).not.toMatch(/transition-\[[^\]]*transform[^\]]*\]/);
  });

  it("respeta a quien pidió menos movimiento en su sistema", () => {
    expect(tarjeta).toContain("motion-reduce:transition-none");
  });
});

describe("el banner principal mide lo que Vitrina le pide al cliente", () => {
  it("es horizontal 3:2, como el '1200 × 800' que se le pidió", async () => {
    // Con el espacio cuadrado, un banner de 1200 × 800 perdía el logo y el
    // titular por los lados sin que nada avisara (12 sep 2026).
    const { readFileSync } = await import("node:fs");
    const maqueta = readFileSync("src/modules/storefront/home-layout.tsx", "utf8");
    const bloque = maqueta.slice(maqueta.indexOf('id="banner:hero_principal"'), maqueta.indexOf('id="banner:hero_lateral"'));
    expect(bloque).toContain("aspect-[3/2]");
    expect(bloque).not.toContain("aspect-square");
    // Y el lateral sale 7:9 (700 × 900) a la misma altura: las columnas
    // están calculadas para eso, no a ojo.
    expect(maqueta).toContain("lg:grid-cols-[1.4fr_0.726fr_1.124fr]");
    const desde = maqueta.indexOf('id="banner:hero_lateral"');
    const lateral = maqueta.slice(desde, maqueta.indexOf("</Region>", desde));
    expect(lateral).toContain("aspect-[7/9]");
    // Y la promo de la parrilla, 3:5 (600 × 1000).
    const promo = maqueta.slice(maqueta.indexOf('id="banner:promo_secundaria"'));
    expect(promo.slice(0, promo.indexOf("</Region>"))).toContain("aspect-[3/5]");
    expect(vitrina).toContain("600 × 1000");
    const vitrina = readFileSync("src/modules/showcase/sections.ts", "utf8");
    expect(vitrina).toContain("1200 × 800");
  });
});

describe("la galería de la ficha rota sola y se funde", () => {
  it("apila las fotos y anima la opacidad; se para al elegir una", async () => {
    // Medido en el navegador el 12 sep 2026: opacidades intermedias
    // 0.89/0.11 → 0.47/0.53 → 0.18/0.82 entre foto y foto. Cambiar el `src`
    // de una sola etiqueta las pintaría de golpe.
    const { readFileSync } = await import("node:fs");
    const ficha = readFileSync("src/app/(tienda)/producto/[slug]/product-detail.tsx", "utf8");
    expect(ficha).toContain("product.images.map((img, i) => (");
    expect(ficha).toContain("transition-opacity duration-700");
    expect(ficha).toContain("setEligioFoto(true)");
    expect(ficha).toContain("prefers-reduced-motion: reduce");
  });
});
