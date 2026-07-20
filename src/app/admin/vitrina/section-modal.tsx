"use client";

// Editor de una sección, abierto desde el lápiz que flota sobre ella.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  addProductToSection,
  moveProductInSection,
  removeProductFromSection,
  updateSection,
} from "@/modules/showcase/actions";
import {
  MAX_SECTION_ITEMS,
  RULE_LABEL,
  type SectionDef,
} from "@/modules/showcase/sections";
import { CategoryTile } from "@/modules/catalog/tiles";
import { ProductPicker } from "./product-picker";

export type SectionState = {
  key: string;
  title: string;
  active: boolean;
  mode: "MANUAL" | "AUTO";
  autoRule: string;
  limit: number;
  products: {
    id: string;
    name: string;
    imageUrl: string | null;
    categoryColor: string;
    categoryIcon: string;
  }[];
};

export function SectionModal({
  def,
  section,
  categoryCount,
  onClose,
}: {
  def: SectionDef;
  section: SectionState;
  categoryCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [title, setTitle] = useState(section.title);

  const isCategories = def.key === "top_categorias";

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "No se pudo guardar");
      else router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(14,15,18,0.55)] p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${section.title}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ece6] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-kora-black">Editar sección</h3>
            <p className="mt-0.5 text-[11.5px] text-[#8a8f98]">{def.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Título */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">
              Título que ve el visitante
            </label>
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-kora-coral"
              />
              <button
                type="button"
                disabled={pending || title.trim() === section.title}
                onClick={() => run(() => updateSection(section.key, { title }))}
                className="rounded-[11px] bg-kora-black px-4 py-2.5 text-[13px] font-bold text-white hover:bg-kora-gray-dark disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>

          {/* Visibilidad */}
          <label className="flex items-center justify-between rounded-[12px] bg-[#faf8f5] px-4 py-3">
            <span className="text-[13px] font-semibold text-kora-black">
              Mostrar esta sección en la tienda
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={section.active}
              disabled={pending}
              onClick={() =>
                run(() => updateSection(section.key, { active: !section.active }))
              }
              className="shrink-0"
            >
              <span
                className={`relative block h-6 w-[42px] rounded-full transition-colors ${
                  section.active ? "bg-kora-coral" : "bg-[#d9d4cc]"
                }`}
              >
                <span
                  className="absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[left]"
                  style={{ left: section.active ? 21 : 3 }}
                />
              </span>
            </button>
          </label>

          {isCategories ? (
            <p className="rounded-[12px] bg-[#faf8f5] px-4 py-3 text-[12.5px] leading-relaxed text-[#6b6f78]">
              Esta sección muestra hasta {section.limit} categorías, tomadas de{" "}
              <strong className="text-kora-black">Productos → Gestionar categorías</strong>{" "}
              en el orden que tengan allí. Hoy hay {categoryCount}.
            </p>
          ) : (
            <>
              {/* Modo */}
              <div>
                <p className="mb-2 text-[12.5px] font-semibold text-[#6b6f78]">
                  ¿Cómo se llena?
                </p>
                <div className="flex gap-0.5 rounded-[11px] bg-[#f5f3f0] p-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => updateSection(section.key, { mode: "MANUAL" }))}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[12.5px] font-bold transition-colors ${
                      section.mode === "MANUAL"
                        ? "bg-kora-black text-white"
                        : "text-[#6b6f78] hover:text-kora-black"
                    }`}
                  >
                    <Hand className="size-3.5" /> Yo elijo
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => updateSection(section.key, { mode: "AUTO" }))}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[12.5px] font-bold transition-colors ${
                      section.mode === "AUTO"
                        ? "bg-kora-black text-white"
                        : "text-[#6b6f78] hover:text-kora-black"
                    }`}
                  >
                    <Sparkles className="size-3.5" /> Automática
                  </button>
                </div>
              </div>

              {section.mode === "AUTO" ? (
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">
                    Se llena sola con
                  </label>
                  <select
                    value={section.autoRule}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateSection(section.key, {
                          autoRule: e.target.value as
                            | "BEST_SELLERS"
                            | "NEWEST"
                            | "ONLINE_DEAL"
                            | "FEATURED",
                        }),
                      )
                    }
                    className="w-full rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-kora-black outline-none focus:border-kora-coral"
                  >
                    {Object.entries(RULE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11.5px] text-[#9aa0ab]">
                    Se ven {section.limit} a la vez y rotan solos. Se actualiza sola
                    cuando cambia el catálogo.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#6b6f78]">
                      Productos ({section.products.length})
                      <span className="ml-1 font-normal text-[#9aa0ab]">
                        · se ven {section.limit} a la vez
                        {section.products.length > section.limit && ", el resto rota solo"}
                      </span>
                    </span>
                    {section.products.length < MAX_SECTION_ITEMS && (
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#FFE9DD] px-3 py-1.5 text-[12px] font-bold text-kora-coral hover:opacity-80"
                      >
                        <Plus className="size-3.5" /> Agregar
                      </button>
                    )}
                  </div>

                  {section.products.length === 0 ? (
                    <div className="rounded-[12px] border-2 border-dashed border-[#e2ddd6] px-4 py-8 text-center">
                      <p className="text-[12.5px] text-[#9aa0ab]">
                        Vacía: la sección no se mostrará en la tienda.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {section.products.map((p, i) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 rounded-[11px] border border-[#f0ece6] p-2"
                        >
                          <span
                            className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[9px]"
                            style={{ background: p.imageUrl ? "#f7f4f0" : p.categoryColor }}
                          >
                            {p.imageUrl ? (
                              <Image
                                src={p.imageUrl}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <CategoryTile
                                color="transparent"
                                icon={p.categoryIcon}
                                size={44}
                                radius={0}
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-kora-black">
                            {p.name}
                          </span>
                          <button
                            type="button"
                            aria-label="Subir"
                            disabled={pending || i === 0}
                            onClick={() =>
                              run(() => moveProductInSection(section.key, p.id, "up"))
                            }
                            className="flex size-7 items-center justify-center rounded bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black disabled:opacity-30"
                          >
                            <ChevronLeft className="size-3.5 rotate-90" />
                          </button>
                          <button
                            type="button"
                            aria-label="Bajar"
                            disabled={pending || i === section.products.length - 1}
                            onClick={() =>
                              run(() => moveProductInSection(section.key, p.id, "down"))
                            }
                            className="flex size-7 items-center justify-center rounded bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black disabled:opacity-30"
                          >
                            <ChevronRight className="size-3.5 rotate-90" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Quitar ${p.name}`}
                            disabled={pending}
                            onClick={() =>
                              run(() => removeProductFromSection(section.key, p.id))
                            }
                            className="flex size-7 items-center justify-center rounded bg-[#faf6f2] text-[#b3b8c0] hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-[12.5px] font-semibold text-destructive">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#f0ece6] px-5 py-4">
          <span className="flex items-center gap-2 text-[12px] text-[#9aa0ab]">
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {pending ? "Guardando…" : "Los cambios se guardan al instante"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[11px] bg-kora-black px-5 py-2.5 text-[13px] font-bold text-white hover:bg-kora-gray-dark"
          >
            Listo
          </button>
        </div>

        {pickerOpen && (
          <ProductPicker
            excludeIds={section.products.map((p) => p.id)}
            onClose={() => setPickerOpen(false)}
            onPick={(product) => {
              setPickerOpen(false);
              run(() => addProductToSection(section.key, product.id));
            }}
          />
        )}
      </div>
    </div>
  );
}
