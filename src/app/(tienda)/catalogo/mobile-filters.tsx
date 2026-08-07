"use client";

// Filtros del catálogo en móvil: chips de categoría pegajosos + dos hojas
// inferiores (Filtros y Ordenar).
//
// La barra lateral de escritorio no cabe en un teléfono: apilada sobre la
// rejilla, empuja el primer producto media pantalla hacia abajo. El diseño
// (§03) la sustituye por chips a la vista y el detalle en bottom-sheets, que
// es donde el pulgar llega.
//
// Todo navega por URL, igual que en escritorio: los filtros son estado
// compartible, no estado de componente. Volver atrás deshace el último filtro.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check, SlidersHorizontal, X } from "lucide-react";

const ORDENES = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precioAsc", label: "Menor precio" },
  { value: "precioDesc", label: "Mayor precio" },
  { value: "nombre", label: "Nombre (A-Z)" },
] as const;

export type CategoriaChip = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  children: { id: string; name: string; slug: string }[];
};

/** Hoja inferior: sube desde abajo y se cierra tocando fuera o con Escape. */
function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45 lg:hidden"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[78vh] w-full overflow-y-auto rounded-t-[22px] bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // El área segura de iOS, para que el último elemento no quede bajo la
        // barra de gestos.
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {/* Asa: en una hoja que sube desde abajo, es lo que dice que se
            arrastra para cerrar. */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-9 rounded-full bg-[#e2ddd6]" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3">
          <h2 className="text-[16px] font-extrabold text-kora-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-9 items-center justify-center rounded-full bg-[#f5f3f0] text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MobileFilters({
  categorias,
  categoriaActiva,
  orden,
  total,
}: {
  categorias: CategoriaChip[];
  categoriaActiva?: string;
  orden: string;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [abierta, setAbierta] = useState<"filtros" | "orden" | null>(null);

  /** Conserva el resto de parámetros y reinicia cuántos se ven. */
  const url = (cambios: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    // Cambiar de filtro empieza de nuevo: mantener "ver=60" tras filtrar
    // dejaría una página larguísima de otra cosa.
    next.delete("ver");
    return `/catalogo?${next}`;
  };

  const ir = (cambios: Record<string, string | null>) => {
    setAbierta(null);
    router.push(url(cambios));
  };

  const ordenActual = ORDENES.find((o) => o.value === orden) ?? ORDENES[0];
  const hayFiltro = Boolean(categoriaActiva);

  return (
    <div className="lg:hidden">
      {/* Chips de categoría: pegajosos bajo la banda de búsqueda.
          `top-[66px]` es el alto de esa banda; el z-index queda POR DEBAJO del
          chrome (z-40) a propósito, para que al volver a asomar el header
          negro los chips pasen por detrás en vez de encima. */}
      <div className="sticky top-[66px] z-30 -mx-4 bg-[#F5F3F0]/95 px-4 py-2.5 backdrop-blur">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={url({ categoria: null })}
            className={`flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${
              !categoriaActiva
                ? "border-kora-black bg-kora-black text-white"
                : "border-[#e2ddd6] bg-white text-[#3c3c3c]"
            }`}
          >
            Todas
          </Link>
          {categorias.map((c) => {
            const activa =
              categoriaActiva === c.slug || c.children.some((ch) => ch.slug === categoriaActiva);
            return (
              <Link
                key={c.id}
                href={url({ categoria: c.slug })}
                className={`flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${
                  activa
                    ? "border-kora-black bg-kora-black text-white"
                    : "border-[#e2ddd6] bg-white text-[#3c3c3c]"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Filtros / Ordenar */}
      <div className="mt-3 mb-4 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setAbierta("filtros")}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-[#e2ddd6] bg-white text-[13.5px] font-semibold text-kora-black"
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {hayFiltro && <span className="size-1.5 rounded-full bg-kora-coral" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setAbierta("orden")}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-[#e2ddd6] bg-white text-[13.5px] font-semibold text-kora-black"
        >
          <ArrowDownUp className="size-4" />
          {ordenActual.label}
        </button>
      </div>

      <Sheet open={abierta === "filtros"} onClose={() => setAbierta(null)} title="Filtros">
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => ir({ categoria: null })}
            className={`flex min-h-12 w-full items-center justify-between rounded-[12px] px-3 text-[14px] ${
              !categoriaActiva ? "bg-[#FFE9DD] font-semibold text-kora-coral" : "text-kora-black"
            }`}
          >
            Todas las categorías
            <span className="text-[12px] text-[#b3b8c0]">{total}</span>
          </button>

          {categorias.map((c) => (
            <div key={c.id}>
              <button
                type="button"
                onClick={() => ir({ categoria: c.slug })}
                className={`flex min-h-12 w-full items-center justify-between rounded-[12px] px-3 text-[14px] ${
                  categoriaActiva === c.slug
                    ? "bg-[#FFE9DD] font-semibold text-kora-coral"
                    : "text-kora-black"
                }`}
              >
                {c.name}
                <span className="text-[12px] text-[#b3b8c0]">{c.productCount}</span>
              </button>

              {(categoriaActiva === c.slug ||
                c.children.some((ch) => ch.slug === categoriaActiva)) &&
                c.children.length > 0 && (
                  <div className="mb-1 ml-3 border-l border-[#f0ece6] pl-2">
                    {c.children.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => ir({ categoria: ch.slug })}
                        className={`flex min-h-11 w-full items-center rounded-[10px] px-3 text-[13px] ${
                          categoriaActiva === ch.slug
                            ? "font-semibold text-kora-coral"
                            : "text-[#6b6f78]"
                        }`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={abierta === "orden"} onClose={() => setAbierta(null)} title="Ordenar por">
        <div className="px-3 pb-2">
          {ORDENES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => ir({ orden: o.value })}
              className={`flex min-h-12 w-full items-center justify-between rounded-[12px] px-3 text-[14px] ${
                o.value === orden ? "font-semibold text-kora-coral" : "text-kora-black"
              }`}
            >
              {o.label}
              {o.value === orden && <Check className="size-[18px]" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
