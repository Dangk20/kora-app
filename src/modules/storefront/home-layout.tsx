// La página de inicio completa, con la estructura del prototipo (§7).
//
// La usan DOS lugares: la tienda real (`/`) y la vista previa del panel de
// Vitrina. Por eso vive aquí y no dentro de una página: el panel es un espejo
// exacto porque literalmente renderiza lo mismo.
import Link from "next/link";
import { MessageCircle, Store, Truck } from "lucide-react";
import type { Currency } from "@/modules/pricing";
import type { ResolvedBanner, ResolvedSection } from "@/modules/showcase/queries";
import type { BannerSlot as SlotKey } from "@/modules/showcase/sections";
import { KoraFlame } from "@/components/kora-flame";
import {
  BannerSlot,
  BrandBand,
  CategoryCircles,
  CompactProductRow,
  CONTAINER,
  DealsPanel,
  EmptySection,
  ProductGrid,
} from "./home-sections";

const GUARANTEES = [
  {
    icon: MessageCircle,
    title: "Atención por WhatsApp",
    text: "Confirmamos tu pedido y resolvemos tus dudas por chat.",
  },
  {
    icon: Store,
    title: "Tienda física y online",
    text: "El mismo inventario, sincronizado en los dos canales.",
  },
  {
    icon: Truck,
    title: "Envíos a todo el país",
    text: "Coordinamos el envío contigo al confirmar el pedido.",
  },
];

export type HomeData = {
  currency: Currency;
  sections: ResolvedSection[];
  banners: Map<SlotKey, ResolvedBanner[]>;
  categories: { id: string; name: string; slug: string; color: string; icon: string }[];
  /** Vista previa del panel de Vitrina: se ve igual, pero no interactúa. */
  preview?: boolean;
  /**
   * Control de edición que se superpone a una sección o banner (el lápiz de
   * Vitrina). La tienda real no lo pasa; el panel sí, y así se edita
   * directamente sobre la página en vez de sobre un formulario aparte.
   */
  editControl?: (key: string) => React.ReactNode;
};

/**
 * Envoltura de una zona editable.
 *
 * SIEMPRE renderiza su div: es un elemento real del layout (una celda de la
 * grilla, la tarjeta blanca de una sección…). Si devolviera un fragmento
 * cuando no hay edición, sus hijos se convertirían en celdas sueltas y la
 * página se rompería. Lo único condicional es el lápiz y el contorno.
 */
function Region({
  id,
  editControl,
  children,
  className,
}: {
  id: string;
  editControl?: (key: string) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const control = editControl?.(id);
  return (
    <div
      className={`${className ?? ""} ${
        control
          ? "relative rounded-[20px] outline-2 outline-dashed outline-[#e2ddd6] outline-offset-4 transition-[outline-color] hover:outline-kora-coral"
          : ""
      }`}
    >
      {control}
      {children}
    </div>
  );
}

export function StoreHomeLayout({
  currency,
  sections,
  banners,
  categories,
  preview = false,
  editControl,
}: HomeData) {
  // En la tienda solo se pintan las secciones activas; en Vitrina se pintan
  // TODAS, incluso vacías u ocultas: si desaparecieran, no habría forma de
  // volver a llenarlas.
  const editable = Boolean(editControl);
  const find = (key: string) =>
    sections.find((s) => s.key === key && (editable || s.active));
  /** ¿Se dibuja la sección? Vacía solo si estamos editando. */
  const show = (section: { products: unknown[] } | undefined) =>
    Boolean(section && (editable || section.products.length > 0));
  const topCategorias = find("top_categorias");
  const mejorSemana = find("mejor_semana");
  const ofertas = find("ofertas");
  const destacados = find("destacados");
  const mejorValorados = find("mejor_valorados");

  return (
    <>
      {/* HERO: banner principal + banner lateral + Top Categorías */}
      <section className={`${CONTAINER} pt-6 pb-10`}>
        <div className="rounded-3xl bg-white p-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.85fr_1fr]">
            {/* El principal es cuadrado y marca la altura de la fila; el
                lateral y las categorías se estiran a esa misma altura. */}
            <Region id="banner:hero_principal" editControl={editControl}>
              <BannerSlot
                banners={banners.get("hero_principal")}
                className="aspect-square w-full"
                placeholderLabel="Banner principal — cárgalo desde Vitrina"
              />
            </Region>
            <Region id="banner:hero_lateral" editControl={editControl} className="h-full">
              <BannerSlot
                banners={banners.get("hero_lateral")}
                className="h-full min-h-[280px]"
                placeholderLabel="Banner lateral — cárgalo desde Vitrina"
              />
            </Region>

            {topCategorias && categories.length > 0 && (
              <Region id="top_categorias" editControl={editControl}>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-kora-black">
                  <KoraFlame className="size-[18px]" />
                  {topCategorias.title}
                </h3>
                <CategoryCircles categories={categories.slice(0, topCategorias.limit)} />
              </Region>
            )}
          </div>

          {show(mejorSemana) && mejorSemana && (
            <Region
              id="mejor_semana"
              editControl={editControl}
              className="mt-[18px] border-t border-[#f0ece6] pt-[18px]"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-bold text-kora-black">{mejorSemana.title}</h3>
                <Link
                  href="/catalogo"
                  className="text-[13px] font-bold text-kora-coral hover:opacity-80"
                >
                  Ver más
                </Link>
              </div>
              {mejorSemana.products.length > 0 ? (
                <CompactProductRow
                  products={mejorSemana.products}
                  currency={currency}
                  columns={Math.min(4, Math.max(1, mejorSemana.products.length))}
                />
              ) : (
                <EmptySection label={mejorSemana.title} />
              )}
            </Region>
          )}
        </div>
      </section>

      {/* OFERTAS: panel oscuro */}
      {show(ofertas) && ofertas && (
        <section className={`${CONTAINER} pb-12`}>
          <Region id="ofertas" editControl={editControl}>
            {ofertas.products.length > 0 ? (
              <DealsPanel
                title={ofertas.title}
                products={ofertas.products}
                currency={currency}
              />
            ) : (
              <EmptySection label={ofertas.title} />
            )}
          </Region>
        </section>
      )}

      {/* GARANTÍAS */}
      <section className={`${CONTAINER} pb-12`}>
        <div className="grid gap-6 rounded-[20px] bg-white px-8 py-7 shadow-[0_4px_22px_rgba(0,0,0,0.05)] sm:grid-cols-3">
          {GUARANTEES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3.5">
              <span className="flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[#FFE9DD] text-kora-coral">
                <Icon className="size-[22px]" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-kora-black">{title}</p>
                <p className="text-[12.5px] leading-snug text-[#6b6f78]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DESTACADOS: columna lateral + parrilla */}
      {show(destacados) && destacados && (
        <section className={`${CONTAINER} pb-14`}>
          <div className="grid items-start gap-5 lg:grid-cols-[288px_1fr]">
            <div className="space-y-4">
              {show(mejorValorados) && mejorValorados && (
                <Region
                  id="mejor_valorados"
                  editControl={editControl}
                  className="rounded-[18px] bg-white p-[22px] shadow-[0_4px_18px_rgba(0,0,0,0.04)]"
                >
                  <h3 className="mb-3 text-[17px] font-bold text-kora-black">
                    {mejorValorados.title}
                  </h3>
                  <div className="space-y-1">
                    {mejorValorados.products.length > 0 ? (
                      <CompactProductRow
                        products={mejorValorados.products}
                        currency={currency}
                        columns={1}
                        carousel={false}
                      />
                    ) : (
                      <EmptySection label={mejorValorados.title} />
                    )}
                  </div>
                </Region>
              )}

              <Region id="banner:promo_secundaria" editControl={editControl}>
                <BannerSlot
                  banners={banners.get("promo_secundaria")}
                  className="min-h-[420px]"
                  placeholderLabel="Promo de la parrilla — cárgala desde Vitrina"
                />
              </Region>
            </div>

            <Region id="destacados" editControl={editControl}>
              {destacados.products.length > 0 ? (
                <ProductGrid
                  title={destacados.title}
                  products={destacados.products}
                  currency={currency}
                  preview={preview}
                />
              ) : (
                <EmptySection label={destacados.title} />
              )}
            </Region>
          </div>
        </section>
      )}

      {/* FRANJA DE MARCA */}
      <section className={`${CONTAINER} pb-16`}>
        <BrandBand />
      </section>
    </>
  );
}
