// Ficha de producto — patrón del prototipo (§6): galería 480px + info,
// descripción y especificaciones abajo, relacionados al final.
// El botón de compra queda anunciado (carrito = S7, pedido por WhatsApp = S8):
// hasta entonces la ficha ofrece contacto directo, no un carrito falso.
import { activeLocale } from "@/modules/i18n/server";
import { MESSAGES, type Messages } from "@/modules/i18n/messages";
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
  const locale = await activeLocale();
  const product = await getProductBySlug(slug, locale);
  if (!product) return {};

  return productMetadata(product, locale);
}

/** Filas de la tabla de especificaciones, omitiendo las que no aplican. */
function specs(
  product: StoreProduct,
  t: Messages["producto"]["specs"],
): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  if (product.brand) rows.push({ key: t.marca, value: product.brand });
  rows.push({
    key: t.categoria,
    value: product.parentCategory
      ? `${product.parentCategory.name} · ${product.category.name}`
      : product.category.name,
  });
  rows.push(
    product.variants.length > 1
      ? { key: t.variantes, value: String(product.variants.length) }
      : { key: t.sku, value: product.variants[0]?.sku ?? "—" },
  );
  rows.push({ key: t.vendedor, value: "KORA" });
  return rows;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await activeLocale();
  const t = MESSAGES[locale].producto;
  const product = await getProductBySlug(slug, locale);
  if (!product) notFound();

  const currency = await activeCurrency();
  const related = await getRelatedProducts(product, 4, locale);
  const categoryLink = product.parentCategory ?? product.category;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 pb-12 sm:px-[22px] sm:pt-6 sm:pb-16">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#8a8f98]">
        <Link href="/" className="hover:text-kora-black">
          {t.inicio}
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

      {/* En móvil, acordeones (diseño §04): la descripción y la tabla de
          especificaciones son un muro de texto entre el precio y los
          relacionados. En escritorio, tarjetas abiertas.

          Son DOS marcados (tarjeta para `sm+`, `<details>` para móvil) y no
          un `<details>` con el contenido forzado visible por CSS, que es lo
          que había: Chrome ahora oculta el contenido de un `<details>`
          cerrado con `::details-content` y el truco dejó de funcionar — en
          escritorio se veían los dos títulos y nada más, en TODOS los
          productos (5 oct 2026).

          Un bloque sin datos no se pinta: un recuadro vacío o un texto de
          relleno se ve peor que no tenerlo (pedido de Daniel). */}
      {(() => {
        const descripcion = product.description?.trim();
        const filas = specs(product, t.specs);
        const bloques = [
          descripcion && {
            titulo: t.descripcion,
            contenido: (
              <p className="text-[14.5px] leading-[1.7] whitespace-pre-line text-[#4a4f58]">
                {descripcion}
              </p>
            ),
          },
          filas.length > 0 && {
            titulo: t.especificaciones,
            contenido: (
              <dl className="text-[13.5px]">
                {filas.map(({ key, value }) => (
                  <div
                    key={key}
                    className="flex justify-between gap-4 border-b border-[#f0ece6] py-2.5 last:border-0"
                  >
                    <dt className="text-[#8a8f98]">{key}</dt>
                    <dd className="text-right font-semibold text-kora-black">{value}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
        ].filter((b): b is { titulo: string; contenido: React.ReactElement } => Boolean(b));
        if (bloques.length === 0) return null;

        return (
          <div
            className={`mt-4 grid gap-3 sm:mt-6 sm:gap-6 ${
              bloques.length > 1 ? "lg:grid-cols-[1.3fr_1fr]" : ""
            }`}
          >
            {bloques.map(({ titulo, contenido }) => (
              <div key={titulo}>
                <section className="hidden h-full rounded-[20px] bg-white p-[30px] shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:block">
                  <h2 className="mb-3 text-xl font-bold text-kora-black">{titulo}</h2>
                  {contenido}
                </section>
                <details className="group rounded-[16px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-kora-black [&::-webkit-details-marker]:hidden">
                    {titulo}
                    <ChevronDown
                      className="size-5 text-[#b3b8c0] transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-3">{contenido}</div>
                </details>
              </div>
            ))}
          </div>
        );
      })()}

      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <h2 className="mb-4 text-xl font-bold text-kora-black sm:text-2xl">
            {t.relacionados}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
