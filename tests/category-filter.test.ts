// Filtro de categoría en dos pasos (Productos e Inventario, 17 oct 2026).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { categoryIdFilter } from "@/modules/catalog/category-filter";

const PREFIJO = "tst-filtro-cat";
let padre = "";
let hija = "";

beforeAll(async () => {
  await db.category.deleteMany({ where: { slug: `${PREFIJO}-hija` } });
  await db.category.deleteMany({ where: { slug: `${PREFIJO}-padre` } });
  padre = (await db.category.create({ data: { name: "Padre", slug: `${PREFIJO}-padre` } })).id;
  hija = (await db.category.create({ data: { name: "Hija", slug: `${PREFIJO}-hija`, parentId: padre } })).id;
});

afterAll(async () => {
  await db.category.deleteMany({ where: { slug: `${PREFIJO}-hija` } });
  await db.category.deleteMany({ where: { slug: `${PREFIJO}-padre` } });
});

describe("filtro de categoría", () => {
  it("sin filtro no restringe", async () => {
    expect(await categoryIdFilter()).toBeUndefined();
  });
  it("la categoría sola incluye sus subcategorías", async () => {
    expect(await categoryIdFilter(padre)).toEqual({ in: [padre, hija] });
  });
  it("la subcategoría manda", async () => {
    expect(await categoryIdFilter(padre, hija)).toBe(hija);
  });
});
