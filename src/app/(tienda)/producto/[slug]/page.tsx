// Ficha de producto — patrón del prototipo (§6): galería 480px + info,
// descripción y especificaciones abajo, relacionados al final.
// El botón de compra queda anunciado (carrito = S7, pedido por WhatsApp = S8):
// hasta entonces la ficha ofrece contacto directo, no un carrito falso.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import {
  getProductBySlug,
  getRelatedProducts,
  type StoreProduct,
} from "@/modules/storefront/queries";
import { ProductCard } from "@/modules/storefront/product-card";
import { productMetadata } from "@/modules/storefront/metadata";
import { ProductDetail } from "./product-detail";

// La vista previa del enlace compartido por WhatsApp es la primera impresión
// del producto en este negocio: sale el nombre, su descripción y su foto, no
// una tarjeta genérica de la tienda.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return productMetadata(product);
}

/** Filas de la tabla de especificaciones, omitiendo las que no aplican. */
function specs(product: StoreProduct): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  if (product.brand) rows.push({ key: "Marca", value: product.brand });
  rows.push({
    key: "Categoría",
    value: product.parentCategory
      ? `${product.parentCategory.name} · ${product.category.name}`
      : product.category.name,
  });
  rows.push(
    product.variants.length > 1
      ? { key: "Variantes", value: String(product.variants.length) }
      : { key: "SKU", value: product.variants[0]?.sku ?? "—" },
  );
  rows.push({ key: "Vendedor", value: "KORA" });
  return rows;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const currency = await activeCurrency();
  const related = await getRelatedProducts(product);
  const categoryLink = product.parentCategory ?? product.category;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 pb-12 sm:px-[22px] sm:pt-6 sm:pb-16">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#8a8f98]">
        <Link href="/" className="hover:text-kora-black">
          Inicio
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link
          href={`/catalogo?categoria=${categoryLink.slug}`}
          className="hover:text-kora-black"
        >
          {categoryLink.name}
        </Link>
        {product.parentCategory && (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link
              href={`/catalogo?categoria=${product.category.slug}`}
              className="hover:text-kora-black"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-semibold text-kora-black">{product.name}</span>
      </nav>

      <ProductDetail product={product} currency={currency} />

      {/* En móvil, acordeones (diseño §04). La descripción y la tabla de
          especificaciones son un muro de texto entre el precio y los productos
          relacionados, y en un teléfono empujan los relacionados fuera de
          alcance.

          `<details>` nativo: sin JavaScript, accesible por teclado y con el
          estado que ya trae el navegador. En escritorio no hay acordeón —el
          resumen deja de responder al clic y el contenido se fuerza visible
          con `[&>*:not(summary)]`—, así que allí siguen siendo las dos
          tarjetas abiertas de siempre.

          Las tres garantías que había aquí se quitaron: viven bajo los botones
          de compra desde la auditoría del 7 ago, y repetirlas era decir dos
          veces lo mismo en la misma pantalla. */}
      <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[1.3fr_1fr]">
        <details className="group rounded-[16px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-[30px] sm:[&>*:not(summary)]:!block">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-kora-black sm:pointer-events-none sm:mb-3 sm:text-xl [&::-webkit-details-marker]:hidden">
            Descripción
            <ChevronDown
              className="size-5 text-[#b3b8c0] transition-transform group-open:rotate-180 sm:hidden"
              aria-hidden
            />
          </summary>
          <p className="mt-3 text-[14.5px] leading-[1.7] whitespace-pre-line text-[#4a4f58] sm:mt-0">
            {product.description?.trim() ||
              `${product.name}${product.brand ? ` de ${product.brand}` : ""}. Escríbenos por WhatsApp y te contamos todos los detalles.`}
          </p>
        </details>

        <details className="group rounded-[16px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-[30px] sm:[&>*:not(summary)]:!block">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-kora-black sm:pointer-events-none sm:mb-3 sm:text-xl [&::-webkit-details-marker]:hidden">
            Especificaciones
            <ChevronDown
              className="size-5 text-[#b3b8c0] transition-transform group-open:rotate-180 sm:hidden"
              aria-hidden
            />
          </summary>
          <dl className="mt-3 text-[13.5px] sm:mt-0">
            {specs(product)
              .map(({ key, value }) => (
                <div
                  key={key}
                  className="flex justify-between border-b border-[#f0ece6] py-2.5 last:border-0"
                >
                  <dt className="text-[#8a8f98]">{key}</dt>
                  <dd className="text-right font-semibold text-kora-black">{value}</dd>
                </div>
              ))}
          </dl>
        </details>
      </div>

      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <h2 className="mb-4 text-xl font-bold text-kora-black sm:text-2xl">
            Productos relacionados
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
