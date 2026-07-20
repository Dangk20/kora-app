// Listado del catálogo — patrón del prototipo (§5): breadcrumb, título con
// conteo, orden a la derecha, sidebar de filtros 262px + grid de 4 columnas.
// Los filtros de marca/precio/descuento del mock llegan en S6 junto con la
// búsqueda avanzada; aquí van categoría y orden, que es lo que S5 pide.
import Link from "next/link";
import { ChevronRight, Flame, SlidersHorizontal } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import { listCategories, listProducts } from "@/modules/storefront/queries";
import { ProductCard } from "@/modules/storefront/product-card";
import { SortSelect } from "./sort-select";

const SORTS = ["relevancia", "precioAsc", "precioDesc", "nombre"] as const;
type Sort = (typeof SORTS)[number];

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; orden?: string }>;
}) {
  const { categoria, q, orden } = await searchParams;
  const sort: Sort = SORTS.includes(orden as Sort) ? (orden as Sort) : "relevancia";
  const currency = await activeCurrency();

  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts({ categorySlug: categoria, search: q, sort, currency }),
  ]);

  const active = categories.find(
    (c) => c.slug === categoria || c.children.some((ch) => ch.slug === categoria),
  );
  const activeChild = active?.children.find((ch) => ch.slug === categoria);

  const title = q
    ? `Resultados para "${q}"`
    : (activeChild?.name ?? active?.name ?? "Todos los productos");

  return (
    <div className="mx-auto max-w-[1320px] px-[22px] pt-6 pb-16">
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
          <h1 className="text-[30px] leading-tight font-bold text-kora-black">{title}</h1>
          <p className="mt-0.5 text-[13px] text-[#8a8f98]">
            {products.length}{" "}
            {products.length === 1 ? "producto" : "productos"}
          </p>
        </div>
        <SortSelect current={sort} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[262px_1fr]">
        <aside className="rounded-[18px] bg-white p-[22px] shadow-[0_4px_18px_rgba(0,0,0,0.04)] lg:sticky lg:top-[140px]">
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] bg-white p-16 text-center">
            <Flame className="mx-auto size-14 text-[#e2ddd6]" />
            <p className="mt-4 text-lg font-semibold text-kora-black">
              No encontramos productos
            </p>
            <p className="mt-1 text-[13.5px] text-[#8a8f98]">
              Prueba con otra categoría o término de búsqueda.
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
