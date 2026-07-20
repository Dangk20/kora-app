// Ficha de producto — patrón del prototipo (§6): galería 480px + info,
// descripción y especificaciones abajo, relacionados al final.
// El botón de compra queda anunciado (carrito = S7, pedido por WhatsApp = S8):
// hasta entonces la ficha ofrece contacto directo, no un carrito falso.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, Store, Truck } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import {
  getProductBySlug,
  getRelatedProducts,
  type StoreProduct,
} from "@/modules/storefront/queries";
import { ProductCard } from "@/modules/storefront/product-card";
import { ProductDetail } from "./product-detail";

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
    <div className="mx-auto max-w-[1320px] px-[22px] pt-6 pb-16">
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[20px] bg-white p-[30px] shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-xl font-bold text-kora-black">Descripción</h2>
          <p className="text-[14.5px] leading-[1.7] whitespace-pre-line text-[#4a4f58]">
            {product.description?.trim() ||
              `${product.name}${product.brand ? ` de ${product.brand}` : ""}. Escríbenos por WhatsApp y te contamos todos los detalles.`}
          </p>
        </section>

        <section className="rounded-[20px] bg-white p-[30px] shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-xl font-bold text-kora-black">Especificaciones</h2>
          <dl className="text-[13.5px]">
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

          <div className="mt-5 grid gap-3">
            {[
              { icon: MessageCircle, text: "Confirmamos tu pedido por WhatsApp" },
              { icon: Store, text: "También disponible en nuestra tienda física" },
              { icon: Truck, text: "Coordinamos el envío contigo" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2.5 rounded-[13px] bg-[#faf8f5] px-3.5 py-3"
              >
                <Icon className="size-5 shrink-0 text-kora-coral" />
                <span className="text-[12.5px] text-[#4a4f58]">{text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold text-kora-black">
            Productos relacionados
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
