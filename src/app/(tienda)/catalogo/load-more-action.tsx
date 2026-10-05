"use server";

// "Cargar más" del catálogo: devuelve las SIGUIENTES tarjetas ya renderizadas
// para que el cliente las agregue al final de la rejilla. Antes era un enlace
// a `?ver=24`, y como la ruta tiene `loading.tsx`, Next cambiaba la página
// entera por el esqueleto mientras volvía a consultar: se sentía como una
// recarga que llevaba arriba, y si tardaba, el botón parecía no hacer nada
// (lo reportó Daniel el 5 oct 2026).
import { activeLocale } from "@/modules/i18n/server";
import { activeCurrency } from "@/modules/pricing/currency";
import { listProducts } from "@/modules/storefront/queries";
import { ProductCard } from "@/modules/storefront/product-card";
import { POR_PAGINA, normalizarOrden } from "./paginacion";

export async function cargarMasProductos(params: {
  categoria?: string;
  q?: string;
  orden?: string;
  desde: number;
}) {
  const currency = await activeCurrency();
  const locale = await activeLocale();
  const products = await listProducts({
    categorySlug: params.categoria,
    search: params.q,
    sort: normalizarOrden(params.orden),
    currency,
    locale,
  });
  const desde = Math.max(0, Math.floor(params.desde));
  const siguientes = products.slice(desde, desde + POR_PAGINA);
  return {
    tarjetas: siguientes.map((p) => (
      <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
    )),
    mostrados: desde + siguientes.length,
    quedan: Math.max(0, products.length - desde - siguientes.length),
  };
}
