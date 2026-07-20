"use client";

// Búsqueda y filtros del listado de pedidos (PED_HU004 §1). Todo en la URL.
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const selectCls =
  "rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-kora-black outline-none focus:border-kora-coral";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendientes" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "PREPARING", label: "En preparación" },
  { value: "SHIPPED", label: "Enviados" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "CANCELLED", label: "Cancelados" },
];

export function OrdersToolbar({
  total,
  pendingCount,
}: {
  total: number;
  pendingCount: number;
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
    next.delete("pagina");
    router.push(`/admin/pedidos?${next}`);
  };

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

  const estado = params.get("estado") ?? "";
  const moneda = params.get("moneda") ?? "";
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  const porPagina = params.get("por") ?? "20";
  const hasFilters = Boolean(query || estado || moneda || desde || hasta);

  return (
    <div className="mb-4 space-y-3">
      {pendingCount > 0 && !estado && (
        <button
          type="button"
          onClick={() => push({ estado: "PENDING" })}
          className="flex items-center gap-2 rounded-[11px] bg-[#FFF4EF] px-4 py-2.5 text-[13px] font-semibold text-kora-coral hover:bg-[#FFE9DD]"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-kora-coral text-[11px] font-bold text-white">
            {pendingCount}
          </span>
          {pendingCount === 1
            ? "pedido pendiente por confirmar"
            : "pedidos pendientes por confirmar"}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9aa0ab]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, nombre, teléfono o email…"
            aria-label="Buscar pedidos"
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
          value={estado}
          onChange={(e) => push({ estado: e.target.value })}
          aria-label="Filtrar por estado"
          className={selectCls}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={moneda}
          onChange={(e) => push({ moneda: e.target.value })}
          aria-label="Filtrar por moneda"
          className={selectCls}
        >
          <option value="">COP y USD</option>
          <option value="COP">Colombia (COP)</option>
          <option value="USD">EE.UU. (USD)</option>
        </select>

        <label className="flex items-center gap-1.5 text-[12.5px] text-[#8a8f98]">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => push({ desde: e.target.value })}
            className={selectCls}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[#8a8f98]">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => push({ hasta: e.target.value })}
            className={selectCls}
          />
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push("/admin/pedidos");
            }}
            className="text-[12.5px] font-semibold text-kora-coral hover:opacity-80"
          >
            Limpiar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[12.5px] text-[#8a8f98]">
            {total} {total === 1 ? "pedido" : "pedidos"}
          </span>
          <select
            value={porPagina}
            onChange={(e) => push({ por: e.target.value })}
            aria-label="Pedidos por página"
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
    </div>
  );
}
