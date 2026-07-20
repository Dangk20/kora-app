"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import {
  importCatalog,
  type ImportActionResult,
} from "@/modules/catalog/import-actions";

/** Slide-over de importación de catálogo, mismo patrón que ProductSheet. */
export function ImportSheet() {
  const router = useRouter();
  const close = () => router.push("/admin/catalogo");
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ImportActionResult, FormData>(
    importCatalog,
    null,
  );

  const success = state?.ok === true ? state.summary : null;
  const errors = state?.ok === false ? state.errors : null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[rgba(14,15,18,0.5)]"
      onClick={close}
    >
      <div
        className="flex h-full w-[480px] max-w-full flex-col overflow-y-auto bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0ece6] bg-white px-7 py-5">
          <h2 className="text-xl font-bold text-kora-black">Importar catálogo</h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-7 py-6">
          <div className="rounded-[14px] bg-[#faf8f5] p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-kora-black">Paso 1.</span> Descarga
              la plantilla y llénala: una fila por variante (SKU), con los 4 precios
              y el stock inicial. Trae hoja de instrucciones y ejemplos.
            </p>
            <a
              href="/admin/catalogo/plantilla"
              className="mt-3 inline-flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2.5 text-[13px] font-semibold text-kora-black hover:bg-muted"
            >
              <FileDown className="size-4" /> Descargar plantilla
            </a>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-kora-black">Paso 2.</span> Sube el
                archivo diligenciado (.xlsx).
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 border-dashed border-[#e2ddd6] px-6 py-8 text-center hover:border-kora-coral hover:bg-[#FFF6F0]">
                <FileSpreadsheet className="size-8 text-[#9aa0ab]" />
                <span className="text-[13.5px] font-semibold text-kora-black">
                  {fileName ?? "Elegir archivo Excel"}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Máximo 8 MB · solo .xlsx
                </span>
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  required
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={pending || !fileName}
              className="bg-kora-gradient flex items-center justify-center gap-2 rounded-[11px] px-[18px] py-3 text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(255,90,31,.3)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Importando…" : "Importar catálogo"}
            </button>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              La importación es todo-o-nada: si hay errores no se guarda ninguna fila.
              Los SKUs que ya existen actualizan precios y datos; su stock no se toca
              (los ajustes de inventario van por Inventario, con kardex).
            </p>
          </form>

          {success && (
            <div className="rounded-[14px] bg-[#FFE9DD] p-4">
              <p className="flex items-center gap-2 text-[13.5px] font-bold text-kora-coral">
                <CheckCircle2 className="size-4" /> Catálogo importado
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-[#16181D]">
                <li>{success.productsCreated} producto(s) nuevos · {success.variantsCreated} variante(s) nuevas</li>
                <li>{success.variantsUpdated} variante(s) actualizadas (precios/datos)</li>
                <li>{success.categoriesCreated} categoría(s) creadas</li>
                <li>{success.unitsReceived} unidades de stock inicial registradas en el kardex</li>
                {success.exampleRowsSkipped > 0 && (
                  <li className="text-muted-foreground">
                    {success.exampleRowsSkipped} fila(s) de ejemplo ignoradas
                  </li>
                )}
              </ul>
              <button
                onClick={close}
                className="mt-3 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-semibold text-kora-black hover:bg-[#f5f3f0]"
              >
                Ver productos
              </button>
            </div>
          )}

          {errors && (
            <div className="rounded-[14px] bg-[#fce8e8] p-4">
              <p className="flex items-center gap-2 text-[13.5px] font-bold text-[#E5484D]">
                <AlertCircle className="size-4" /> No se importó nada — corrige y vuelve a subir
              </p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[13px] text-[#16181D]">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold">Fila {e.row}:</span> {e.message}
                  </li>
                ))}
                {errors.length > 50 && (
                  <li className="text-muted-foreground">…y {errors.length - 50} error(es) más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
