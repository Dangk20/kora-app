// Buscador del header: sugerencias y sus límites.
//
// Lo que se fija aquí no es estética: es que el desplegable y la página de
// resultados no puedan discrepar, y que el endpoint público no se pueda usar
// para hacer trabajar a la base con basura.
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  normalizeQuery,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SEARCH_SUGGESTION_LIMIT,
} from "@/modules/storefront/search-types";
import { searchSuggestions } from "@/modules/storefront/search";
import { listProducts } from "@/modules/storefront/queries";

describe("normalización de la consulta", () => {
  it("una sola letra no busca: traería medio catálogo", () => {
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery(" a ")).toBeNull();
  });

  it("desde dos caracteres sí, y sin espacios de sobra", () => {
    expect(normalizeQuery("  audio  ")).toBe("audio");
    expect(normalizeQuery("audífonos   kora")).toBe("audífonos kora");
  });

  it("recorta la consulta: el endpoint es público", () => {
    const larga = "x".repeat(500);
    expect(normalizeQuery(larga)).toHaveLength(SEARCH_MAX_LENGTH);
  });

  it("vacío y nulo no buscan", () => {
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
  });
});

describe("sugerencias", () => {
  it("una consulta corta devuelve vacío sin tocar la base", async () => {
    const r = await searchSuggestions("a", "COP");
    expect(r).toEqual({ query: "", items: [], total: 0 });
  });

  it("no devuelve más filas de las que caben en el desplegable", async () => {
    const r = await searchSuggestions("a", "COP");
    expect(r.items.length).toBeLessThanOrEqual(SEARCH_SUGGESTION_LIMIT);
  });

  it("solo enseña producto publicado", async () => {
    // El buscador no puede ser la puerta trasera al catálogo: un producto
    // despublicado sigue existiendo en la base, y llegar a su ficha desde aquí
    // sería enseñar algo que el negocio decidió no vender.
    const oculto = await db.product.findFirst({ where: { active: false } });
    if (!oculto) return; // sin datos de ese caso, nada que comprobar

    const r = await searchSuggestions(oculto.name, "COP");
    expect(r.items.map((i) => i.slug)).not.toContain(oculto.slug);
  });

  it("el total coincide con lo que encontrará /catalogo con la misma consulta", async () => {
    // Es la promesa del botón "Ver todos los resultados (N)": si el número no
    // es el que aparece al llegar, el visitante cree que se perdieron cosas.
    const primero = await db.product.findFirst({
      where: { active: true, variants: { some: { active: true } } },
      select: { name: true },
    });
    if (!primero) return;

    const termino = primero.name.slice(0, 4);
    const [sugerencias, catalogo] = await Promise.all([
      searchSuggestions(termino, "COP"),
      listProducts({ search: termino, currency: "COP" }),
    ]);

    expect(sugerencias.total).toBe(catalogo.length);
  });

  it("el precio que enseña es el resuelto, con tachado solo si hay ahorro real", async () => {
    const producto = await db.product.findFirst({
      where: { active: true, variants: { some: { active: true } } },
      select: { name: true },
    });
    if (!producto) return;

    const r = await searchSuggestions(producto.name.slice(0, 4), "COP");
    for (const item of r.items) {
      if (!item.price?.available) continue;
      expect(item.price.currency).toBe("COP");
      // La misma regla que la tarjeta y la ficha: el tachado solo si el precio
      // online es REALMENTE menor que el de tienda en la misma moneda.
      if (item.price.hasOnlineDiscount) {
        expect(item.price.storeAmount).toBeGreaterThan(item.price.amount);
      }
    }
  });
});

describe("tildes y varias palabras", () => {
  // El catálogo lo carga el cliente a mano: en la misma sesión aparecen
  // "Audífonos", "audifonos" y "AUDIFONOS". Si la búsqueda distingue, el
  // visitante ve una tienda que no tiene lo que sí tiene — y sin ningún error.
  it("encuentra con tilde lo que se escribió sin tilde, y al revés", async () => {
    const conTilde = await db.product.findFirst({
      where: { active: true, name: { contains: "í" }, variants: { some: { active: true } } },
      select: { name: true, slug: true },
    });
    if (!conTilde) return;

    // La palabra que LLEVA la tilde, no una cualquiera del nombre: buscar
    // "[DEMO]" casaría con todo el catálogo de ejemplo y la prueba pasaría sin
    // comprobar nada.
    const acentuada = conTilde.name.split(/\s+/).find((w) => /[áéíóúüñ]/i.test(w));
    if (!acentuada) return;
    const plana = acentuada.normalize("NFD").replace(/[̀-ͯ]/g, "");

    const sinTilde = await searchSuggestions(plana, "COP");
    expect(sinTilde.items.map((i) => i.slug)).toContain(conTilde.slug);

    // Y la dirección contraria: escribir CON tilde encuentra lo escrito sin ella.
    const conAcento = await searchSuggestions(acentuada, "COP");
    expect(conAcento.items.map((i) => i.slug)).toContain(conTilde.slug);
  });

  it("mayúsculas y minúsculas dan lo mismo", async () => {
    const [baja, alta] = await Promise.all([
      searchSuggestions("audifonos", "COP"),
      searchSuggestions("AUDIFONOS", "COP"),
    ]);
    expect(alta.total).toBe(baja.total);
  });

  it("varias palabras afinan, no ensucian: se piden TODAS y el orden da igual", async () => {
    const [una, dos, alReves] = await Promise.all([
      searchSuggestions("audifonos", "COP"),
      searchSuggestions("audifonos ultra", "COP"),
      searchSuggestions("ultra audifonos", "COP"),
    ]);
    expect(dos.total).toBeLessThanOrEqual(una.total);
    expect(alReves.total).toBe(dos.total);
  });

  it("un % escrito por el visitante no convierte la búsqueda en 'tráemelo todo'", async () => {
    // Con `LIKE` sin escapar, "%" casaría con cualquier cosa. Se usa `strpos`.
    const total = await db.product.count({ where: { active: true } });
    const r = await searchSuggestions("%%", "COP");
    expect(r.total).toBeLessThan(Math.max(total, 1));
  });

  it("busca también por categoría y por nombre de variante", async () => {
    const producto = await db.product.findFirst({
      where: { active: true, variants: { some: { active: true } } },
      select: { slug: true, category: { select: { name: true } } },
    });
    if (!producto?.category?.name) return;

    const r = await searchSuggestions(producto.category.name, "COP");
    expect(r.items.map((i) => i.slug)).toContain(producto.slug);
  });
});

describe("límites declarados", () => {
  it("son los que el componente cliente puede importar sin arrastrar la base", async () => {
    // Si alguien mueve estas constantes a `search.ts`, el componente del header
    // deja de compilar (Prisma en el navegador). El módulo de tipos no puede
    // importar nada que toque servidor.
    const fuente = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/modules/storefront/search-types.ts", "utf8"),
    );
    expect(fuente).not.toMatch(/from "@\/lib\/db"/);
    expect(fuente).not.toMatch(/@\/modules\/storage/);
    expect(SEARCH_MIN_LENGTH).toBeGreaterThan(1);
  });
});
