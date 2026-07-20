// Secciones de la página de inicio, con la estructura del prototipo (§7).
// Se comparten entre la tienda real y la vista previa de Vitrina, así el
// panel es un espejo exacto y no dos maquetas que se desincronizan.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";
import { KoraFlame } from "@/components/kora-flame";
import { AutoCarousel } from "./auto-carousel";
import { formatPriceRange, resolvePrice, type Currency } from "@/modules/pricing";
import { CategoryTile } from "@/modules/catalog/tiles";
import type { ResolvedBanner } from "@/modules/showcase/queries";
import { BannerCarousel } from "./banner-carousel";
import { productAmounts, type StoreProduct } from "./queries";
import { ProductCard } from "./product-card";

/** Contenedor de 1320px del prototipo. */
export const CONTAINER = "mx-auto max-w-[1320px] px-[22px]";

/** Espacio publicitario: puede tener varias piezas y rota solo. */
export function BannerSlot({
  banners,
  className,
  placeholderLabel,
}: {
  banners: ResolvedBanner[] | undefined;
  className?: string;
  placeholderLabel: string;
}) {
  return (
    <BannerCarousel
      banners={banners ?? []}
      className={className}
      placeholderLabel={placeholderLabel}
    />
  );
}

/** Accesos redondos de categoría del hero (§7.1). */
export function CategoryCircles({
  categories,
}: {
  categories: { id: string; name: string; slug: string; color: string; icon: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-4">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/catalogo?categoria=${c.slug}`}
          className="group flex flex-col items-center gap-2"
        >
          {/* Color plano neutro como el prototipo; el acento de marca
              aparece solo al pasar el cursor. */}
          <span className="flex size-[62px] items-center justify-center rounded-full bg-[#F5F3F0] text-kora-black transition-colors group-hover:bg-[#FFE9DD] group-hover:text-kora-coral">
            <CategoryTile color="transparent" icon={c.icon} size={62} radius={999} />
          </span>
          <span className="text-center text-[11.5px] leading-tight text-[#4a4f58] group-hover:text-kora-coral">
            {c.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Fila compacta: tile pequeño, nombre y precio (§7.1 sub-bloque). */
export function CompactProductRow({
  products,
  currency,
  columns = 4,
  carousel = true,
}: {
  products: StoreProduct[];
  currency: Currency;
  /** Cuántos se ven a la vez; el resto rota solo. */
  columns?: number;
  /** En una columna vertical no tiene sentido rotar: se apilan. */
  carousel?: boolean;
}) {
  const cards = products.map((p) => {
        const amounts = productAmounts(p, currency);
        const image = p.images[0];
        return (
          <Link
            key={p.id}
            href={`/producto/${p.slug}`}
            className="flex items-center gap-3 rounded-[14px] p-2.5 hover:bg-[#faf8f5]"
          >
            <span
              className="relative flex size-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[11px]"
              style={{ background: image ? "#f7f4f0" : p.category.color }}
            >
              {image ? (
                <Image
                  src={image.url}
                  alt={p.name}
                  fill
                  sizes="58px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <CategoryTile color="transparent" icon={p.category.icon} size={58} radius={0} />
              )}
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[12.5px] leading-tight font-semibold text-kora-black">
                {p.name}
              </span>
              <span className="mt-1 block text-[13.5px] font-bold text-kora-coral">
                {formatPriceRange(amounts, currency)}
              </span>
            </span>
          </Link>
        );
  });

  if (!carousel) return <div className="space-y-1">{cards}</div>;

  return (
    <AutoCarousel perView={columns} gapClass="gap-3">
      {cards}
    </AutoCarousel>
  );
}

/** Panel oscuro de ofertas (§7.2). */
export function DealsPanel({
  title,
  products,
  currency,
}: {
  title: string;
  products: StoreProduct[];
  currency: Currency;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-kora-black p-8">
      <span
        className="bg-kora-gradient pointer-events-none absolute -top-16 -left-16 size-56 rounded-full opacity-30 blur-3xl"
        aria-hidden
      />
      <div className="relative grid items-center gap-7 lg:grid-cols-[240px_1fr]">
        <div>
          <KoraFlame className="mb-3 size-12" variant="white" />
          <h2 className="text-[30px] leading-[1.05] font-bold text-white">{title}</h2>
          <Link
            href="/catalogo"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14px] font-bold text-kora-black transition-transform hover:-translate-y-0.5"
          >
            Ver todo <ArrowRight className="size-4" />
          </Link>
        </div>

        <AutoCarousel perView={4} gapClass="gap-3.5" tone="dark">
          {products.map((p) => {
            const image = p.images[0];
            const amounts = productAmounts(p, currency);
            const variant = p.variants[0];
            const price = variant ? resolvePrice(variant.prices, currency) : null;
            return (
              <Link
                key={p.id}
                href={`/producto/${p.slug}`}
                className="rounded-2xl bg-white p-3 transition-transform hover:-translate-y-1"
              >
                <span
                  className="relative mb-2.5 flex h-[118px] items-center justify-center overflow-hidden rounded-[11px]"
                  style={{ background: image ? "#f7f4f0" : p.category.color }}
                >
                  {image ? (
                    <Image
                      src={image.url}
                      alt={p.name}
                      fill
                      sizes="220px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <CategoryTile color="transparent" icon={p.category.icon} size={72} radius={0} />
                  )}
                </span>
                <span className="line-clamp-2 h-8 text-[12px] leading-tight text-kora-black">
                  {p.name}
                </span>
                <span className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[15px] font-bold text-kora-coral">
                    {formatPriceRange(amounts, currency)}
                  </span>
                  {price?.hasOnlineDiscount && (
                    <span className="text-[11px] text-[#b3b8c0] line-through">
                      {formatPriceRange([price.storeAmount], currency)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </AutoCarousel>
      </div>
    </div>
  );
}

/** Parrilla de productos con encabezado y enlace a "ver todo". */
export function ProductGrid({
  title,
  products,
  currency,
  preview = false,
}: {
  title: string;
  products: StoreProduct[];
  currency: Currency;
  preview?: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[26px] font-bold text-kora-black">{title}</h2>
        <Link
          href="/catalogo"
          className="flex items-center gap-1.5 text-[13px] font-bold text-kora-coral hover:opacity-80"
        >
          Ver todo <ArrowRight className="size-4" />
        </Link>
      </div>
      {/* Sin carrusel a propósito: esta parrilla crece hacia abajo y la
          página entera ya hace scroll (decisión de Daniel, 19 jul). */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} preview={preview} />
        ))}
      </div>
    </section>
  );
}

/** Franja de marca del cierre (§7.5). */
export function BrandBand() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-[linear-gradient(120deg,#FFE9DD,#FBEFD6)] p-10">
      <div>
        <h2 className="text-[34px] leading-tight font-extrabold tracking-[-0.5px] text-kora-black">
          KORA, todo en un{" "}
          <span className="font-accent text-kora-coral italic">solo lugar</span>
        </h2>
        <p className="mt-2 max-w-[460px] text-[15px] text-[#6b6f78]">
          Explora el catálogo, arma tu pedido y lo cerramos juntos por WhatsApp.
        </p>
      </div>
      <Link
        href="/catalogo"
        className="flex items-center gap-2 rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-semibold text-white transition-transform hover:-translate-y-0.5"
      >
        Empieza a comprar <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/** Aviso que ocupa el lugar de una sección vacía mientras se edita. */
export function EmptySection({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#e2ddd6] bg-white/60 px-6 py-10 text-center">
      <PackagePlus className="size-8 text-[#d9d4cc]" />
      <p className="text-[13px] font-semibold text-kora-black">{label}</p>
      <p className="text-[11.5px] text-[#9aa0ab]">
        Usa el lápiz para agregar productos. Vacía, no se muestra en la tienda.
      </p>
    </div>
  );
}
