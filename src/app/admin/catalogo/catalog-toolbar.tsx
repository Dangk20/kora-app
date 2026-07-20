"use client";

// Barra de búsqueda y filtros del listado de productos. Todo vive en la URL
// (?q=&categoria=&estado=&por=&pagina=) para que un filtro se pueda compartir
// o recargar sin perderlo.
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export type ToolbarCategory = { id: string; name: string; parentName: string | null };

const selectCls =
  "rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-kora-black outline-none focus:border-kora-coral";

export function CatalogToolbar({
  categories,
  total,
}: {
  categories: ToolbarCategory[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const push = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Cualquier cambio de filtro vuelve a la página 1: si estabas en la 3 y
    // filtras a 5 resultados, la 3 estaría vacía.
    next.delete("pagina");
    router.push(`/admin/catalogo?${next}`);
  };

  // Búsqueda con espera: no dispara una consulta por cada tecla.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (query !== (params.get("q") ?? "")) push({ q: query });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const categoria = params.get("categoria") ?? "";
  const estado = params.get("estado") ?? "";
  const porPagina = params.get("por") ?? "20";
  const hasFilters = Boolean(query || categoria || estado);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9aa0ab]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o SKU…"
          aria-label="Buscar productos"
          className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white py-2.5 pr-9 pl-10 text-[13.5px] outline-none focus:border-kora-coral"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9aa0ab] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <select
        value={categoria}
        onChange={(e) => push({ categoria: e.target.value })}
        aria-label="Filtrar por categoría"
        className={selectCls}
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
          </option>
        ))}
      </select>

      <select
        value={estado}
        onChange={(e) => push({ estado: e.target.value })}
        aria-label="Filtrar por estado"
        className={selectCls}
      >
        <option value="">Todos los estados</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Inactivos</option>
        <option value="agotado">Agotados</option>
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.push("/admin/catalogo");
          }}
          className="text-[12.5px] font-semibold text-kora-coral hover:opacity-80"
        >
          Limpiar
        </button>
      )}

      <div className="ml-auto flex items-center gap-2.5">
        <span className="text-[12.5px] text-[#8a8f98]">
          {total} {total === 1 ? "producto" : "productos"}
        </span>
        <select
          value={porPagina}
          onChange={(e) => push({ por: e.target.value })}
          aria-label="Productos por página"
          className={selectCls}
        >
          {[20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
