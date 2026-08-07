// Reglas de rastreo y sitemap.
//
// Lo que se fija aquí no es cosmética: un `robots.txt` mal resuelto no rompe
// ninguna pantalla. Si producción se publicara con `Disallow: /`, la tienda
// simplemente no aparecería en Google y nadie lo notaría hasta revisar Search
// Console semanas después.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { db } from "@/lib/db";
import { RUTAS_PRIVADAS } from "@/modules/legal/routes";
import { LEGAL_LINKS } from "@/modules/legal/content";

const BASE = "https://kora-test.local";

/** Deja el entorno como un despliegue de producción real. */
function comoProduccion(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("KORA_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_STORE_URL", BASE);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots.txt — qué se rastrea", () => {
  it("producción permite la tienda y bloquea todo lo que no es catálogo", () => {
    comoProduccion();
    const r = robots();
    const regla = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    expect(regla.allow).toBe("/");

    const bloqueadas = ([] as string[]).concat(regla.disallow ?? []);
    for (const ruta of RUTAS_PRIVADAS) {
      expect(bloqueadas).toContain(`${ruta}/`);
    }
  });

  it("declara el sitemap y el dominio", () => {
    comoProduccion();
    const r = robots();

    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
    expect(r.host).toBe(BASE);
  });

  it("el entorno de pruebas prohíbe el sitio entero", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KORA_ENV", "staging");

    const r = robots();
    const regla = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    expect(regla.disallow).toBe("/");
    expect(regla.allow).toBeUndefined();
    // Sin sitemap: declararlo invitaría a rastrear justo lo que se prohíbe.
    expect(r.sitemap).toBeUndefined();
  });

  it("desarrollo prohíbe el sitio entero", () => {
    vi.stubEnv("NODE_ENV", "development");

    const r = robots();
    const regla = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(regla.disallow).toBe("/");
  });

  it("KORA_ENV ausente en un build de producción SÍ se rastrea", () => {
    // Es la convención desplegada (deploy/README.md): solo pruebas se declara.
    // Si esto se invirtiera, producción saldría con `Disallow: /` en silencio.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KORA_ENV", "");

    const r = robots();
    const regla = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(regla.allow).toBe("/");
  });

  it("las rutas privadas cubren todas las zonas que no son tienda", () => {
    // Si mañana nace `/admin-v2` o `/api-interna`, esta lista tiene que
    // crecer. La prueba no puede adivinar el futuro, pero sí fijar el presente.
    for (const esperada of ["/admin", "/login", "/cuenta", "/carrito", "/checkout", "/suscripcion"]) {
      expect(RUTAS_PRIVADAS as readonly string[]).toContain(esperada);
    }
  });
});

describe("nada que dependa del entorno se congela en el build", () => {
  // Los tres se resolvían en tiempo de build, y la MISMA imagen corre en
  // pruebas y en producción. Con `robots.txt` prerrenderizado, pruebas servía
  // un archivo que invita a rastrearlo; con las legales prerrenderizadas, la
  // política quedaba grabada con "[RAZÓN SOCIAL PENDIENTE]" incluso en
  // producción con las variables puestas. Ninguno de los dos da error.
  // Se comprueba sobre la fuente y no importando el módulo porque uno de los
  // tres es un `.tsx` y estas pruebas corren en entorno `node`, sin JSX.
  it.each([
    ["src/app/robots.ts", "robots.txt"],
    ["src/app/sitemap.ts", "sitemap"],
    ["src/app/(tienda)/legal/[slug]/page.tsx", "páginas legales"],
  ])("%s (%s) se resuelve al pedirlo, no al construir la imagen", (ruta) => {
    const fuente = readFileSync(join(process.cwd(), ruta), "utf8");

    expect(fuente).toMatch(/export const dynamic = "force-dynamic"/);
    // `generateStaticParams` volvería a prerrenderarlas aunque esté lo anterior.
    expect(fuente).not.toContain("generateStaticParams");
  });
});

describe("sitemap — se construye sobre el catálogo real", () => {
  const SLUG = "zz-test-sitemap-producto";
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    // Solo el dominio, NO `NODE_ENV=production`: fingir producción aquí
    // dispararía la guarda de almacenamiento y el driver de R2 —que estos
    // tests no necesitan— porque el sitemap resuelve las imágenes del catálogo.
    vi.stubEnv("NEXT_PUBLIC_STORE_URL", BASE);

    const categoria = await db.category.upsert({
      where: { slug: "zz-test-sitemap-categoria" },
      update: { active: true },
      create: {
        name: "ZZ Test Sitemap",
        slug: "zz-test-sitemap-categoria",
        active: true,
        color: "#000000",
        icon: "package",
      },
    });
    categoryId = categoria.id;

    const producto = await db.product.upsert({
      where: { slug: SLUG },
      update: { active: true },
      create: {
        name: "ZZ Producto de prueba del sitemap",
        slug: SLUG,
        active: true,
        categoryId,
        variants: {
          create: {
            sku: "ZZ-SITEMAP-001",
            name: "Única",
            active: true,
            priceCopStore: 10000,
            priceCopOnline: 10000,
            priceUsdStore: 3,
            priceUsdOnline: 3,
          },
        },
      },
    });
    productId = producto.id;
  });

  afterAll(async () => {
    await db.variant.deleteMany({ where: { product: { slug: SLUG } } });
    await db.product.deleteMany({ where: { slug: SLUG } });
    await db.category.deleteMany({ where: { slug: "zz-test-sitemap-categoria" } });
  });

  it("incluye home, catálogo y las tres páginas legales", async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain(BASE);
    expect(urls).toContain(`${BASE}/catalogo`);
    for (const l of LEGAL_LINKS) {
      expect(urls).toContain(`${BASE}${l.href}`);
    }
  });

  it("un producto publicado aparece con su fecha real de modificación", async () => {
    const entrada = (await sitemap()).find((e) => e.url === `${BASE}/producto/${SLUG}`);

    expect(entrada).toBeDefined();
    expect(entrada?.lastModified).toBeInstanceOf(Date);

    const enBase = await db.product.findUnique({
      where: { id: productId },
      select: { updatedAt: true },
    });
    expect((entrada?.lastModified as Date).getTime()).toBe(enBase?.updatedAt.getTime());
  });

  it("un producto despublicado desaparece", async () => {
    await db.product.update({ where: { id: productId }, data: { active: false } });

    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/producto/${SLUG}`);
  });

  it("un producto sin variantes activas desaparece, igual que en la tienda", async () => {
    // "Publicado" es más que `active`: la tienda exige al menos una variante
    // activa. El sitemap hereda esa definición porque usa la misma consulta.
    await db.variant.updateMany({ where: { productId }, data: { active: false } });

    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/producto/${SLUG}`);
  });

  it("no filtra ninguna URL privada", async () => {
    const urls = (await sitemap()).map((e) => e.url);

    for (const url of urls) {
      const ruta = url.replace(BASE, "") || "/";
      for (const privada of RUTAS_PRIVADAS) {
        expect(ruta.startsWith(privada)).toBe(false);
      }
    }
  });

  it("todas las URL son absolutas y cuelgan del dominio configurado", async () => {
    for (const e of await sitemap()) {
      expect(e.url.startsWith(`${BASE}/`) || e.url === BASE).toBe(true);
    }
  });
});
