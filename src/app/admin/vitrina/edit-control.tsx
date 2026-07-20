"use client";

// Lápiz de edición que flota sobre una sección de la vitrina.
// Se trabaja directamente sobre la página: el control aparece al pasar el
// cursor y abre el editor de esa sección en un modal.
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { SectionDef } from "@/modules/showcase/sections";
import { SectionModal, type SectionState } from "./section-modal";

export function SectionEditControl({
  def,
  section,
  categoryCount,
}: {
  def: SectionDef;
  section: SectionState;
  categoryCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Editar: ${section.title}`}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-kora-black/90 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)] backdrop-blur transition-colors hover:bg-kora-coral"
      >
        <Pencil className="size-3.5" />
        Editar
      </button>

      {!section.active && (
        <span className="absolute top-3 left-3 z-20 rounded-full bg-[#f0ece6] px-2.5 py-1 text-[11px] font-bold text-[#8a8f98]">
          Oculta en la tienda
        </span>
      )}

      {open && (
        <SectionModal
          def={def}
          section={section}
          categoryCount={categoryCount}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
