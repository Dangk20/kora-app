"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ProductForm, type ProductDraft } from "./product-form";

/** Slide-over de 480px desde la derecha, como el formulario del prototipo. */
export function ProductSheet({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: ProductDraft;
}) {
  const router = useRouter();
  const close = () => router.push("/admin/catalogo");

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
          <h2 className="text-xl font-bold text-kora-black">
            {initial ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <ProductForm categories={categories} initial={initial} onDone={close} />
      </div>
    </div>
  );
}
