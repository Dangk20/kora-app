// Listado del catálogo — patrón del prototipo (§5): breadcrumb, título con
// conteo, orden a la derecha, sidebar de filtros 262px + grid de 4 columnas.
// Los filtros de marca/precio/descuento del mock llegan en S6 junto con la
// búsqueda avanzada; aquí van categoría y orden, que es lo que S5 pide.
import { activeLocale } from "@/modules/i18n/server";
import Link from "next/link";
import { ChevronRight, Flame, SlidersHorizontal } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import { listCategories, listProducts } from "@/modules/storefront/queries";
import { ProductCard } from "@/modules/storefront/product-card";
import { storeMetadata } from "@/modules/storefront/metadata";
import { SortSelect } from "./sort-select";
import { MobileFilters } from "./mobile-filters";
import { CatalogGrid } from "./catalog-grid";
import { POR_PAGINA, normalizarOrden } from "./paginacion";

export const metadata = storeMetadata({
  title: "Catálogo",
  description:
    "Explora todo el catálogo de KORA por categoría, marca y precio. Compra en línea y coordina tu pedido por WhatsApp.",
  path: "/catalogo",
});

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; orden?: string; ver?: string }>;
}) {
  const { categoria, q, orden, ver } = await searchParams;
  const sort = normalizarOrden(orden);
  const currency = await activeCurrency();
  const locale = await activeLocale();

  const [categories, products] = await Promise.all([
    listCategories(locale),
    listProducts({ categorySlug: categoria, search: q, sort, currency, locale }),
  ]);

  const active = categories.find(
    (c) => c.slug === categoria || c.children.some((ch) => ch.slug === categoria),
  );
  const activeChild = active?.children.find((ch) => ch.slug === categoria);

  // Cuántos se ven. Se acota a un múltiplo razonable para que nadie fuerce
  // `?ver=999999` y tumbe la página.
  const pedidos = Number(ver);
  const visibles = Math.min(
    Number.isFinite(pedidos) && pedidos > 0 ? Math.ceil(pedidos / POR_PAGINA) * POR_PAGINA : POR_PAGINA,
    products.length,
  );
  const mostrados = products.slice(0, visibles);
  const quedan = products.length - mostrados.length;

  const title = q
    ? `Resultados para "${q}"`
    : (activeChild?.name ?? active?.name ?? "Todos los productos");

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 pb-12 sm:px-[22px] sm:pt-6 sm:pb-16">
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-[#8a8f98]">
        <Link href="/" className="hover:text-kora-black">
          Inicio
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        {active ? (
          <>
            <Link
              href={`/catalogo?categoria=${active.slug}`}
              className="hover:text-kora-black"
            >
              {active.name}
            </Link>
            {activeChild && (
              <>
                <ChevronRight className="size-3.5" aria-hidden />
                <span className="font-semibold text-kora-black">{activeChild.name}</span>
              </>
            )}
          </>
        ) : (
          <span className="font-semibold text-kora-black">
            {q ? "Búsqueda" : "Catálogo"}
          </span>
        )}
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight font-bold text-kora-black sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#8a8f98]">
            {products.length}{" "}
            {products.length === 1 ? "producto" : "productos"}
          </p>
        </div>
        {/* En móvil el orden vive en su hoja inferior, no en un <select> que
            abre el menú nativo del sistema encima de todo. */}
        <div className="hidden lg:block">
          <SortSelect current={sort} />
        </div>
      </div>

      <MobileFilters
        categorias={categories}
        categoriaActiva={categoria}
        orden={sort}
        total={products.length}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[262px_1fr]">
        <aside className="hidden rounded-[18px] bg-white p-[22px] shadow-[0_4px_18px_rgba(0,0,0,0.04)] lg:sticky lg:top-[140px] lg:block">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-[18px] text-kora-coral" />
              <span className="text-base font-semibold text-kora-black">Categorías</span>
            </div>
            {(categoria || q) && (
              <Link
                href="/catalogo"
                className="text-xs font-semibold text-kora-coral hover:opacity-80"
              >
                Limpiar
              </Link>
            )}
          </div>

          <div className="space-y-1">
            <Link
              href={q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"}
              className={`block rounded-[9px] px-3 py-2.5 text-[13px] ${
                !categoria
                  ? "bg-[#FFE9DD] font-semibold text-kora-coral"
                  : "text-[#3a3f48] hover:bg-[#faf8f5]"
              }`}
            >
              Todas
            </Link>
            {categories.map((c) => (
              <div key={c.id}>
                <Link
                  href={`/catalogo?categoria=${c.slug}`}
                  className={`flex items-center justify-between rounded-[9px] px-3 py-2.5 text-[13px] ${
                    categoria === c.slug
                      ? "bg-[#FFE9DD] font-semibold text-kora-coral"
                      : "text-[#3a3f48] hover:bg-[#faf8f5]"
                  }`}
                >
                  {c.name}
                  <span className="text-[11.5px] text-[#b3b8c0]">{c.productCount}</span>
                </Link>
                {(categoria === c.slug ||
                  c.children.some((ch) => ch.slug === categoria)) &&
                  c.children.length > 0 && (
                    <div className="mt-0.5 ml-3 space-y-0.5 border-l border-[#f0ece6] pl-2">
                      {c.children.map((ch) => (
                        <Link
                          key={ch.id}
                          href={`/catalogo?categoria=${ch.slug}`}
                          className={`block rounded-[9px] px-2.5 py-2 text-[12.5px] ${
                            categoria === ch.slug
                              ? "font-semibold text-kora-coral"
                              : "text-[#6b6f78] hover:text-kora-black"
                          }`}
                        >
                          {ch.name}
                        </Link>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </aside>

        {products.length > 0 ? (
          <CatalogGrid
            // La clave reinicia lo cargado al cambiar de categoría, búsqueda u orden.
            key={`${categoria ?? ""}|${q ?? ""}|${orden ?? ""}`}
            mostradosIniciales={mostrados.length}
            quedanIniciales={quedan}
            filtros={{ categoria, q, orden }}
          >
            {mostrados.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </CatalogGrid>
        ) : (
          <div className="rounded-[18px] bg-white px-6 py-12 text-center sm:p-16">
            <Flame className="mx-auto size-14 text-[#e2ddd6]" />
            <p className="mt-4 text-lg font-semibold text-kora-black">
              No encontramos productos con esos filtros
            </p>
            <p className="mt-1 text-[13.5px] text-[#8a8f98]">
              Prueba quitando alguno.
            </p>
            <Link
              href="/catalogo"
              className="bg-kora-gradient mt-5 inline-block rounded-full px-5 py-3 text-[13.5px] font-bold text-white hover:opacity-90"
            >
              Ver todo el catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
