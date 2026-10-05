// La Vitrina admite categorías enteras en "Yo elijo" (change
// `vitrina-por-categoria`). Se prueba la expansión, que es pura.
import { describe, expect, it } from "vitest";
import { TOPE_POR_CATEGORIA, expandirElementos } from "@/modules/showcase/expand";

const prod = (id: string, cat: string, parent: string | null = null) => ({
  id,
  category: { id: cat },
  parentCategory: parent ? { id: parent } : null,
});

// Catálogo en su orden: Mujer › Short (s1, s2), Mujer › Falda (f1), Hombre › Polos (h1).
const catalogo = [prod("s1", "short", "mujer"), prod("s2", "short", "mujer"), prod("f1", "falda", "mujer"), prod("h1", "polos", "hombre")];
const ids = (r: { id: string }[]) => r.map((p) => p.id);

describe("Vitrina: elementos de producto y de categoría", () => {
  it("una subcategoría aporta solo sus productos, en el orden del catálogo", () => {
    expect(ids(expandirElementos([{ kind: "category", categoryId: "short" }], catalogo))).toEqual(["s1", "s2"]);
  });

  it("una categoría padre incluye sus subcategorías", () => {
    expect(ids(expandirElementos([{ kind: "category", categoryId: "mujer" }], catalogo))).toEqual(["s1", "s2", "f1"]);
  });

  it("no repite: un producto suelto y su categoría salen una vez, donde aparecen primero", () => {
    const r = expandirElementos(
      [{ kind: "product", productId: "s2" }, { kind: "category", categoryId: "short" }, { kind: "product", productId: "h1" }],
      catalogo,
    );
    expect(ids(r)).toEqual(["s2", "s1", "h1"]);
  });

  it("lo que no está publicado no aparece", () => {
    expect(ids(expandirElementos([{ kind: "product", productId: "despublicado" }, { kind: "category", categoryId: "vacia" }], catalogo))).toEqual([]);
  });

  it("cada categoría aporta como mucho el tope", () => {
    const grande = Array.from({ length: 40 }, (_, i) => prod(`p${i}`, "mujer"));
    expect(expandirElementos([{ kind: "category", categoryId: "mujer" }], grande)).toHaveLength(TOPE_POR_CATEGORIA);
  });
});
