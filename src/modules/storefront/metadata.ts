// Metadata para compartir un enlace de la tienda.
//
// No es cosmética en este negocio: el cobro y la atención ocurren por WhatsApp,
// así que el enlace pegado en un chat ES la primera impresión del producto.
// Hoy esa vista previa sale vacía.

import type { Metadata } from "next";
import { storeUrl } from "@/lib/site";
import type { StoreProduct } from "./queries";

/** Imagen de respaldo cuando el producto todavía no tiene fotos cargadas. */
const IMAGEN_MARCA = "/logo-kora.png";

const NOMBRE = "KORA";
const LEMA = "Todo lo que quieres, en un solo lugar";

/**
 * Metadata de una página pública de la tienda.
 *
 * `images` acepta una URL absoluta (las de producto vienen del CDN) o una ruta
 * del sitio, que Next resuelve contra `metadataBase`.
 */
export function storeMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = `${storeUrl()}${opts.path}`;
  const image = opts.image ?? IMAGEN_MARCA;

  // El `title` de la página lo completa la plantilla del layout raíz
  // ("%s · KORA"), pero esa plantilla NO se aplica a Open Graph: si no se
  // escribe aquí, la vista previa saldría sin la marca.
  const titleCompleto = `${opts.title} · ${NOMBRE}`;

  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: NOMBRE,
      locale: "es_CO",
      title: titleCompleto,
      description: opts.description,
      url,
      images: [{ url: image, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleCompleto,
      description: opts.description,
      images: [image],
    },
  };
}

/** Descripción de una ficha: la del producto, o una construida con lo que hay. */
export function productDescription(product: StoreProduct): string {
  const propia = product.description?.trim();
  if (propia) {
    // Las vistas previas cortan alrededor de 160-200 caracteres; cortar aquí
    // evita que el recorte parta una palabra por la mitad.
    return propia.length > 180 ? `${propia.slice(0, 177).trimEnd()}…` : propia;
  }

  const marca = product.brand ? `${product.brand} · ` : "";
  return `${marca}${product.category.name} en ${NOMBRE}. ${LEMA}.`;
}

export function productMetadata(product: StoreProduct): Metadata {
  return storeMetadata({
    // El nombre del producto va primero: el layout raíz añade "· KORA".
    title: product.name,
    description: productDescription(product),
    path: `/producto/${product.slug}`,
    image: product.images[0]?.url,
  });
}
