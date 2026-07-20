"use client";

// Lápiz de edición de un espacio publicitario, sobre la propia pieza.
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { ResolvedBanner } from "@/modules/showcase/queries";
import { BannerModal } from "./banner-modal";

export type SlotDef = { slot: string; title: string; hint: string; ratio: string };

export function BannerEditControl({
  def,
  banners,
}: {
  def: SlotDef;
  banners: ResolvedBanner[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${def.title} · ${banners.length} pieza(s)`}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-kora-black/90 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)] backdrop-blur transition-colors hover:bg-kora-coral"
      >
        <Pencil className="size-3.5" />
        {banners.length === 0
          ? "Cargar imagen"
          : `Editar (${banners.length})`}
      </button>

      {banners.length > 0 && banners.every((b) => !b.active) && (
        <span className="absolute top-3 left-3 z-20 rounded-full bg-[#f0ece6] px-2.5 py-1 text-[11px] font-bold text-[#8a8f98]">
          Oculto en la tienda
        </span>
      )}

      {open && (
        <BannerModal def={def} banners={banners} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
