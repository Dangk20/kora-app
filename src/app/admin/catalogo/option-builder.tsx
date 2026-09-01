"use client";

// El constructor de grupos de opciones: Talla → M, S.
//
// Ver openspec/changes/variantes-por-opciones — specs/product-options.
//
// Máximo DOS grupos en esta versión: con tres, la matriz pasa de cuatro filas
// a decenas y esto deja de caber en un panel lateral.

import { Plus, X } from "lucide-react";
import type { OptionGroup } from "@/modules/catalog/options";

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-sm outline-none focus:border-kora-coral";

const MAX_GRUPOS = 2;

export function OptionBuilder({
  grupos,
  onChange,
}: {
  grupos: OptionGroup[];
  onChange: (g: OptionGroup[]) => void;
}) {
  const setGrupo = (i: number, patch: Partial<OptionGroup>) =>
    onChange(grupos.map((g, j) => (i === j ? { ...g, ...patch } : g)));

  const setValor = (i: number, j: number, value: string) =>
    setGrupo(i, {
      values: grupos[i].values.map((v, k) => (k === j ? { ...v, value } : v)),
    });

  return (
    <div className="space-y-3">
      {/* El PADRE y los HIJOS tienen que verse distintos. Con tres campos
          idénticos, "Talla", "M" y "S" parecen tres cosas del mismo rango y el
          operador no entiende qué agrupa a qué — que es justo la confusión que
          este modelo venía a resolver. El grupo lleva su etiqueta, tipografía
          mayor y fondo propio; las opciones van indentadas contra un riel. */}
      {grupos.map((g, i) => (
        <div key={i} className="overflow-hidden rounded-xl border-[1.6px] border-[#eee9e2]">
          <div className="flex items-end gap-2.5 bg-[#faf8f5] px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`grupo-${i}`}
                className="mb-1 block text-[10.5px] font-bold tracking-[0.5px] text-[#9aa0ab] uppercase"
              >
                Grupo de opciones
              </label>
              <input
                id={`grupo-${i}`}
                className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[15px] font-bold text-kora-black outline-none focus:border-kora-coral"
                value={g.name}
                onChange={(e) => setGrupo(i, { name: e.target.value })}
                placeholder="Ej. Talla, Color"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(grupos.filter((_, j) => j !== i))}
              aria-label={`Quitar el grupo ${g.name || i + 1}`}
              className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-white text-[#b3b8c0] hover:text-destructive"
            >
              <X className="size-[16px]" />
            </button>
          </div>

          <div className="px-3.5 py-3">
            <p className="mb-2 text-[10.5px] font-bold tracking-[0.5px] text-[#9aa0ab] uppercase">
              Opciones de {g.name.trim() || "este grupo"}
            </p>
            <div className="space-y-2 border-l-2 border-[#f0ece6] pl-3.5">
              {g.values.map((v, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#d9d4cc]" aria-hidden />
                  <input
                    className={inputCls}
                    value={v.value}
                    onChange={(e) => setValor(i, j, e.target.value)}
                    placeholder="Ej. M, Azul, 500 ml"
                  />
                  {g.values.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGrupo(i, { values: g.values.filter((_, k) => k !== j) })
                      }
                      aria-label={`Quitar la opción ${v.value || j + 1}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#faf6f2] text-[#b3b8c0] hover:text-destructive"
                    >
                      <X className="size-[16px]" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setGrupo(i, { values: [...g.values, { value: "" }] })}
                className="flex items-center gap-1.5 pt-0.5 text-[12.5px] font-bold text-kora-coral hover:opacity-80"
              >
                <Plus className="size-3.5" /> Agregar opción
              </button>
            </div>
          </div>
        </div>
      ))}

      {grupos.length < MAX_GRUPOS && (
        <button
          type="button"
          onClick={() => onChange([...grupos, { name: "", values: [{ value: "" }] }])}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.6px] border-dashed border-[#d9d4cc] py-2.5 text-[12.5px] font-bold text-kora-coral hover:border-kora-coral"
        >
          <Plus className="size-3.5" /> Agregar grupo de opciones
        </button>
      )}

      {grupos.length >= MAX_GRUPOS && (
        <p className="text-[11.5px] text-[#8a8f98]">
          Dos grupos es el máximo por ahora. Con tres, las combinaciones se
          multiplican hasta decenas de filas.
        </p>
      )}
    </div>
  );
}
