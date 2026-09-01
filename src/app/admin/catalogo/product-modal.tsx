"use client";

// El ALTA de un producto: modal grande y centrado, con el recorrido por pasos.
//
// Ver openspec/changes/variantes-por-opciones — design.md decisión 9.
//
// El MISMO contenedor para crear y para editar. Al principio editar se quedó
// en el panel lateral —"ahí se entra a cambiar una cosa"— y era peor: dos
// interfaces para el mismo objeto, con la matriz apretada en 480 px justo
// cuando hay más que ver. Con las pestañas navegables el argumento desaparece.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ProductForm, type CategoryNode, type ProductDraft } from "./product-form";

export function ProductModal({
  categories,
  initial,
}: {
  categories: CategoryNode[];
  initial?: ProductDraft;
}) {
  const router = useRouter();
  const close = () => router.push("/admin/catalogo");

  // Con el modal abierto, la página de atrás no se desplaza; y Escape cierra,
  // que es lo que todo el mundo intenta primero.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alEscapar = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", alEscapar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alEscapar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,15,18,0.5)] p-4 sm:p-8"
      onClick={close}
    >
      {/* `max-h` + scroll interno: en un portátil de 13" el alta completa no
          cabe de alto, y un modal que se sale de la pantalla esconde su propio
          botón de guardar. */}
      <div
        className="flex max-h-full w-full max-w-[820px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-20px_rgba(14,15,18,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0ece6] px-7 py-5">
          <div>
            <h2 className="text-xl font-bold text-kora-black">
              {initial ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="text-[12.5px] text-[#8a8f98]">
              {initial
                ? "Salta a la pestaña que necesites y guarda."
                : "Tres pasos: qué es, cómo se vende y cuánto hay."}
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ProductForm
            categories={categories}
            initial={initial}
            onDone={close}
            modo="pasos"
          />
        </div>
      </div>
    </div>
  );
}
