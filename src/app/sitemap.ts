import type { MetadataRoute } from "next";
import { storeUrl } from "@/lib/site";
import { LEGAL_LINKS } from "@/modules/legal/content";
import { listCategories, listProductSlugs } from "@/modules/storefront/queries";

// El sitemap parte de la MISMA definición de "producto publicado" que la
// tienda (`PUBLICADO` en `src/modules/storefront/queries.ts`), nunca de un
// `where` propio.
//
// Escribir aquí un `prisma.product.findMany({ where: { active: true } })` sería
// crear una segunda definición. El día que cambie la primera —que ya es más que
// `active`: exige al menos una variante activa— el sitemap seguiría declarando
// URL que devuelven 404, y nadie lo notaría hasta verlo en Search Console
// semanas después.
//
// Pide `listProductSlugs()` y no `listProducts()`: aquélla resuelve las URL de
// las imágenes contra el driver de almacenamiento, y este archivo solo necesita
// slugs y fechas. Reutilizarla exigía R2 configurado para generar un archivo de
// texto, y tumbaba el build.
//
// Sin paginación a propósito: el límite de un sitemap son 50.000 URL y el
// catálogo real ronda las 1.000. Si algún día se acerca, Next admite sitemaps
// particionados sin cambiar este enfoque.

// Se genera al pedirlo, no al construir la imagen. Un sitemap prerrenderizado
// quedaría congelado con el catálogo que hubiera el día del despliegue: cada
// producto publicado después sería invisible para Google hasta el siguiente
// despliegue, sin que nada fallara.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = storeUrl();

  const [productos, categorias] = await Promise.all([
    listProductSlugs(),
    listCategories(),
  ]);

  const estaticas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    ...LEGAL_LINKS.map((l) => ({
      url: `${base}${l.href}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  return [
    ...estaticas,
    ...categorias.map((c) => ({
      url: `${base}/catalogo?categoria=${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...productos.map((p) => ({
      url: `${base}/producto/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
