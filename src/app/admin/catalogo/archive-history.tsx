"use client";

// El historial de productos retirados.
//
// Existe porque retirar algo del catálogo es una decisión que alguien va a
// cuestionar meses después —"¿y esto por qué ya no está?"— y sin registro la
// respuesta es la memoria de quien lo hizo. Guarda el motivo, quién, cuándo y
// CUÁNTO tenía en ese momento: sin lo último, "se retiró con stock" es una
// frase que nadie puede volver a comprobar.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X, Archive, RotateCcw, Trash2 } from "lucide-react";
import { restoreProduct } from "@/modules/catalog/product-actions";

export type ArchiveRow = {
  id: string;
  productName: string;
  reason: string;
  hadStock: number;
  hadOrders: number;
  deleted: boolean;
  actor: string;
  fecha: string;
  /** Nulo cuando el producto se borró o ya volvió al catálogo. */
  restaurableId: string | null;
};

export function ArchiveHistory({ filas }: { filas: ArchiveRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const close = () => router.push("/admin/catalogo");

  const restaurar = (id: string) =>
    start(async () => {
      await restoreProduct(id);
      router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,15,18,0.5)] p-4 sm:p-8"
      onClick={close}
    >
      <div
        className="flex h-[min(80vh,680px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-20px_rgba(14,15,18,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0ece6] px-7 py-5">
          <div>
            <h2 className="text-xl font-bold text-kora-black">Productos retirados</h2>
            <p className="text-[12.5px] text-[#8a8f98]">
              Qué se retiró, por qué, quién y qué tenía en ese momento.
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-5">
          {filas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Todavía no se ha retirado ningún producto.
            </p>
          ) : (
            <div className="space-y-3">
              {filas.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border-[1.6px] border-[#eee9e2] px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-2.5">
                      <span
                        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                          f.deleted
                            ? "bg-[#fdecec] text-destructive"
                            : "bg-[#f5f3f0] text-[#8a8f98]"
                        }`}
                      >
                        {f.deleted ? (
                          <Trash2 className="size-[14px]" />
                        ) : (
                          <Archive className="size-[14px]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-kora-black">
                          {f.productName}
                        </p>
                        <p className="text-[11.5px] text-[#9aa0ab]">
                          {f.deleted ? "Eliminado" : "Archivado"} · {f.fecha} · {f.actor}
                        </p>
                      </div>
                    </div>
                    {!f.deleted && (
                      <span className="shrink-0 text-[11.5px] whitespace-nowrap text-[#8a8f98]">
                        {f.hadStock} u. · {f.hadOrders}{" "}
                        {f.hadOrders === 1 ? "venta" : "ventas"}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 border-l-2 border-[#f0ece6] pl-3 text-[13px] leading-relaxed text-[#4a4f58]">
                    {f.reason}
                  </p>

                  {/* Sin esto, archivar por error no tiene vuelta atrás y la
                      única salida es volver a crear el producto — perdiendo el
                      historial que archivar existía para conservar. Vuelve
                      INACTIVO: republicarlo es otra decisión. */}
                  {f.restaurableId && (
                    <button
                      type="button"
                      onClick={() => restaurar(f.restaurableId!)}
                      disabled={pending}
                      className="mt-2.5 ml-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-kora-coral hover:opacity-80 disabled:opacity-50"
                    >
                      <RotateCcw className="size-[13px]" /> Devolver al catálogo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
