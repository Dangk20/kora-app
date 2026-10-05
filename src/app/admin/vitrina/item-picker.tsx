"use client";

// Agregar a una sección de la Vitrina, con SELECTORES PREVIOS (pedido de
// Daniel, 4 oct 2026): primero qué se agrega —un producto o una categoría
// entera—, luego la categoría y, si se quiere, la subcategoría. Con
// "Producto", la lista se filtra por esos selectores; con "Categoría", se
// agrega la categoría como tal y sus productos nuevos entran solos.
//
// Componente aparte de `ProductPicker` a propósito: ese lo usan también los
// banners y las campañas, que solo eligen productos.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { FolderTree, Loader2, Package, Plus, Search, X } from "lucide-react";
import {
  categoryTreeForShowcase,
  searchProductsForShowcase,
} from "@/modules/showcase/actions";

type Result = { id: string; name: string; sku: string; imageUrl: string | null };
type Tree = Awaited<ReturnType<typeof categoryTreeForShowcase>>;

const SELECT =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-kora-black outline-none focus:border-kora-coral disabled:opacity-50";

export function ItemPicker({
  excludeProductIds,
  onPickProduct,
  onPickCategory,
  onClose,
}: {
  excludeProductIds: string[];
  onPickProduct: (productId: string) => void;
  onPickCategory: (categoryId: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"product" | "category">("product");
  const [tree, setTree] = useState<Tree>([]);
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    categoryTreeForShowcase().then(setTree);
  }, []);

  // El filtro efectivo: la subcategoría si se eligió; si no, la categoría
  // (que incluye sus subcategorías).
  const filtro = childId || parentId || undefined;

  useEffect(() => {
    if (kind !== "product") return;
    const timer = setTimeout(() => {
      startLoading(async () => setResults(await searchProductsForShowcase(term, filtro)));
    }, 250);
    return () => clearTimeout(timer);
  }, [term, filtro, kind]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const parent = tree.find((c) => c.id === parentId);
  const visible = results.filter((r) => !excludeProductIds.includes(r.id));
  const etiquetaCategoria = parent
    ? childId
      ? `${parent.name} › ${parent.children.find((h) => h.id === childId)?.name ?? ""}`
      : `${parent.name} (con todas sus subcategorías)`
    : "";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(14,15,18,0.55)] p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Agregar a la sección"
      >
        <div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4">
          <h3 className="text-[15px] font-bold text-kora-black">Agregar a la sección</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-[#f0ece6] px-5 py-4">
          {/* 1 · Qué se agrega */}
          <div className="flex gap-0.5 rounded-[11px] bg-[#f5f3f0] p-1">
            {(
              [
                ["product", "Producto", Package],
                ["category", "Categoría", FolderTree],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[12.5px] font-bold transition-colors ${
                  kind === value ? "bg-kora-black text-white" : "text-[#6b6f78] hover:text-kora-black"
                }`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* 2 · Categoría y subcategoría (opcional) */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[#6b6f78]">Categoría</span>
              <select
                value={parentId}
                onChange={(e) => {
                  setParentId(e.target.value);
                  setChildId("");
                }}
                className={SELECT}
              >
                <option value="">{kind === "product" ? "Todas" : "Elige una…"}</option>
                {tree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[#6b6f78]">
                Subcategoría <span className="font-normal text-[#9aa0ab]">(opcional)</span>
              </span>
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                disabled={!parent || parent.children.length === 0}
                className={SELECT}
              >
                <option value="">{parent ? "Todas" : "Primero la categoría"}</option>
                {parent?.children.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {kind === "product" && (
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9aa0ab]" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar por nombre, marca o SKU…"
                className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2.5 pr-3 pl-9 text-[13.5px] outline-none focus:border-kora-coral"
              />
            </div>
          )}
        </div>

        {/* 3 · Resultado */}
        {kind === "category" ? (
          <div className="px-5 py-5">
            {parent ? (
              <>
                <p className="text-[12.5px] leading-relaxed text-[#6b6f78]">
                  La sección mostrará los productos de{" "}
                  <strong className="text-kora-black">{etiquetaCategoria}</strong>. Los
                  productos nuevos de esa categoría entran solos.
                </p>
                <button
                  type="button"
                  onClick={() => onPickCategory(childId || parentId)}
                  className="bg-kora-gradient mt-4 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-3 text-[13px] font-bold text-white hover:opacity-90"
                >
                  <Plus className="size-4" /> Agregar categoría
                </button>
              </>
            ) : (
              <p className="py-6 text-center text-[13px] text-[#9aa0ab]">
                Elige la categoría y, si quieres, una subcategoría.
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            {loading && visible.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-[#b3b8c0]" />
              </div>
            ) : visible.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#9aa0ab]">
                {term || filtro ? "Ningún producto coincide." : "No hay productos disponibles."}
              </p>
            ) : (
              visible.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPickProduct(r.id)}
                  className="flex w-full items-center gap-3 rounded-[11px] p-2.5 text-left hover:bg-[#faf8f5]"
                >
                  <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#f7f4f0]">
                    {r.imageUrl ? (
                      <Image src={r.imageUrl} alt="" fill sizes="44px" className="object-contain p-1" unoptimized />
                    ) : (
                      <span className="text-[10px] text-[#b3b8c0]">Sin foto</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-kora-black">{r.name}</span>
                    <span className="block text-[11.5px] text-[#9aa0ab]">SKU {r.sku}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
