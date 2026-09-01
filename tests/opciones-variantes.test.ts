// Las reglas de las opciones y sus combinaciones.
// Ver openspec/changes/variantes-por-opciones — specs/product-options.
//
// Son puras a propósito: es la parte que se equivoca EN SILENCIO —un SKU
// ambiguo, un color que se ofrece sin stock— y por eso tiene que poder
// probarse sin base de datos ni navegador.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  combinacionesPosibles,
  nombreDeCombinacion,
  paraSku,
  skuPropuesto,
  valoresAlcanzables,
  variantePara,
  type OptionGroup,
  type VarianteConOpciones,
} from "@/modules/catalog/options";

const talla: OptionGroup = { name: "Talla", values: [{ value: "M" }, { value: "S" }] };
const color: OptionGroup = { name: "Color", values: [{ value: "Azul" }, { value: "Rojo" }] };

describe("el nombre visible de una variante", () => {
  it("junta sus valores en el orden de los grupos", () => {
    expect(nombreDeCombinacion(["M", "Azul"])).toBe("M · Azul");
  });

  it("un producto sin valores se sigue llamando Única", () => {
    // Es el catálogo entero anterior a este cambio: no puede quedarse sin
    // nombre, porque `variant.name` lo leen 23 sitios.
    expect(nombreDeCombinacion([])).toBe("Única");
  });
});

describe("el SKU propuesto", () => {
  it("se compone del código base y los valores", () => {
    expect(skuPropuesto("CAM", ["M", "Azul"])).toBe("CAM-M-AZUL");
  });

  it("normaliza tildes y espacios", () => {
    expect(paraSku("Azul océano")).toBe("AZUL-OCEANO");
    expect(skuPropuesto("cam", ["Talla Única"])).toBe("CAM-TALLA-UNICA");
  });

  it("NO abrevia: dos valores que empiezan igual dan SKU distintos", () => {
    // La razón por la que no se abrevia. Con "AZ" para los dos, dos productos
    // distintos compartirían SKU y el inventario dejaría de cuadrar sin dar
    // ningún error — y un SKU ambiguo no se puede detectar después.
    const a = skuPropuesto("CAM", ["Azul"]);
    const b = skuPropuesto("CAM", ["Azufre"]);
    expect(a).not.toBe(b);
  });

  it("sin código base, el SKU sale solo de los valores", () => {
    expect(skuPropuesto("", ["M", "Azul"])).toBe("M-AZUL");
  });
});

describe("las combinaciones posibles", () => {
  it("un grupo da una por valor", () => {
    expect(combinacionesPosibles([talla], "CAM").map((c) => c.name)).toEqual(["M", "S"]);
  });

  it("dos grupos dan el cruce completo", () => {
    const c = combinacionesPosibles([talla, color], "CAM");
    expect(c.map((x) => x.name)).toEqual([
      "M · Azul",
      "M · Rojo",
      "S · Azul",
      "S · Rojo",
    ]);
    expect(c.map((x) => x.sku)).toEqual([
      "CAM-M-AZUL",
      "CAM-M-ROJO",
      "CAM-S-AZUL",
      "CAM-S-ROJO",
    ]);
  });

  it("sin grupos no propone nada", () => {
    // Un producto simple no tiene combinaciones: tiene una variante.
    expect(combinacionesPosibles([], "CAM")).toEqual([]);
    expect(combinacionesPosibles([{ name: "Talla", values: [] }], "CAM")).toEqual([]);
  });
});

describe("resolver la variante desde lo elegido", () => {
  const variantes: VarianteConOpciones[] = [
    { id: "ma", values: ["M", "Azul"], onlineUnits: 5 },
    { id: "mr", values: ["M", "Rojo"], onlineUnits: 0 },
    { id: "sa", values: ["S", "Azul"], onlineUnits: 3 },
    // S · Rojo NO existe: nunca se creó.
  ];

  it("encuentra la combinación elegida", () => {
    expect(variantePara(variantes, ["M", "Azul"])?.id).toBe("ma");
  });

  it("una selección incompleta no resuelve nada", () => {
    expect(variantePara(variantes, ["M", null])).toBeNull();
  });

  it("una combinación que no existe se comporta como agotada", () => {
    // Desde el lado del comprador es lo mismo: no se puede comprar. La
    // diferencia solo le importa al operador.
    expect(variantePara(variantes, ["S", "Rojo"])).toBeNull();
  });
});

describe("qué valores siguen siendo alcanzables", () => {
  const variantes: VarianteConOpciones[] = [
    { id: "ma", values: ["M", "Azul"], onlineUnits: 5 },
    { id: "mr", values: ["M", "Rojo"], onlineUnits: 0 },
    { id: "sa", values: ["S", "Azul"], onlineUnits: 3 },
  ];
  const grupos = [talla, color];

  it("con M elegida, Rojo no es alcanzable porque no tiene cupo", () => {
    const posibles = valoresAlcanzables(variantes, grupos, ["M", null], 1);
    expect([...posibles]).toEqual(["Azul"]);
  });

  it("con S elegida, Rojo tampoco: esa combinación no existe", () => {
    const posibles = valoresAlcanzables(variantes, grupos, ["S", null], 1);
    expect([...posibles]).toEqual(["Azul"]);
  });

  it("sin nada elegido, se ofrecen las tallas que tienen alguna salida", () => {
    const posibles = valoresAlcanzables(variantes, grupos, [null, null], 0);
    expect([...posibles].sort()).toEqual(["M", "S"]);
  });

  it("con Azul elegido, ambas tallas siguen disponibles", () => {
    const posibles = valoresAlcanzables(variantes, grupos, [null, "Azul"], 0);
    expect([...posibles].sort()).toEqual(["M", "S"]);
  });
});

describe("el stock inicial de una variante nueva", () => {
  // La regla 1 del proyecto: `stockActual` y `onlineUnits` SOLO cambian dentro
  // del motor. Hasta el 1 sep 2026 el formulario de producto los escribía a
  // mano — creaba el movimiento y materializaba por su cuenta—, mientras el
  // importador sí usaba el motor. Dos caminos para mover inventario es lo que
  // esa regla existe para impedir.
  const accion = readFileSync("src/modules/catalog/product-actions.ts", "utf8");

  it("entra por receiveStock() del motor", () => {
    expect(accion).toContain("receiveStock(tx, {");
  });

  it("no materializa stockActual ni onlineUnits por su cuenta", () => {
    expect(accion).not.toMatch(/data:\s*\{\s*stockActual:/);
    expect(accion).not.toMatch(/onlineUnits:\s*v\.initialStock/);
  });
});

describe("editar un producto que ya tiene opciones", () => {
  // EL FALLO QUE ESTO IMPIDE (1 sep 2026): la edición no cargaba los grupos ni
  // el enlace de cada variante con sus valores. El formulario abría con las
  // opciones VACÍAS y, como manda la estructura completa, guardarlo significaba
  // "quítalas todas": el producto perdía sus opciones y sus variantes quedaban
  // sueltas. Sin ningún error, y con el operador creyendo que solo cambió el
  // nombre.
  const pagina = readFileSync("src/app/admin/catalogo/page.tsx", "utf8");

  it("carga los grupos y sus valores", () => {
    expect(pagina).toContain("options: {");
    expect(pagina).toContain("values: { orderBy: { position: \"asc\" } }");
  });

  it("carga el enlace de cada variante con sus valores", () => {
    expect(pagina).toContain("optionValues: { include: { value: true } }");
  });

  it("los valores viajan EN EL ORDEN DE LOS GRUPOS", () => {
    // La matriz cruza variantes con combinaciones por posición: desordenados,
    // no encontraría ninguna y el producto aparecería sin sus combinaciones.
    expect(pagina).toContain("optionValues: editing.options.map(");
  });
});
