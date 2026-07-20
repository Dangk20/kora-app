"use client";

// Modal para elegir un producto: busca por nombre, marca o SKU.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Search, X } from "lucide-react";
import { searchProductsForShowcase } from "@/modules/showcase/actions";

type Result = { id: string; name: string; sku: string; imageUrl: string | null };

export function ProductPicker({
  excludeIds,
  onPick,
  onClose,
  title = "Elegir producto",
}: {
  excludeIds?: string[];
  /** Devuelve el producto completo: quien lo abre suele necesitar el nombre. */
  onPick: (product: Result) => void;
  onClose: () => void;
  title?: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startLoading(async () => setResults(await searchProductsForShowcase(term)));
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const visible = results.filter((r) => !excludeIds?.includes(r.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,15,18,0.55)] p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-[520px] max-w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4">
          <h3 className="text-[15px] font-bold text-kora-black">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-[#f0ece6] px-5 py-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9aa0ab]" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nombre o SKU…"
              autoFocus
              className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2.5 pr-3 pl-9 text-[13.5px] outline-none focus:border-kora-coral"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && visible.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-[#b3b8c0]" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#9aa0ab]">
              {term ? "Ningún producto coincide." : "No hay productos disponibles."}
            </p>
          ) : (
            visible.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-center gap-3 rounded-[11px] p-2.5 text-left hover:bg-[#faf8f5]"
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#f7f4f0]">
                  {r.imageUrl ? (
                    <Image
                      src={r.imageUrl}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-[10px] text-[#b3b8c0]">Sin foto</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-kora-black">
                    {r.name}
                  </span>
                  <span className="block text-[11.5px] text-[#9aa0ab]">SKU {r.sku}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
