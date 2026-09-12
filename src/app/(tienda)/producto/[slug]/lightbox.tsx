"use client";

// La foto a tamaño completo, sobre la ficha.
//
// Petición de Daniel (12 sep 2026): tocar la foto principal, en móvil o en
// escritorio, abre un visor para verla en detalle. Es el `Dialog` del
// sistema —con su foco atrapado, Esc y bloqueo del scroll— vestido de negro:
// la foto es lo único que importa aquí, y el fondo del panel competiría con
// ella. Flechas y teclado para pasar; en móvil, deslizar.

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function Lightbox({
  images,
  index,
  open,
  onIndex,
  onClose,
  nombre,
}: {
  images: { url: string; alt: string | null }[];
  index: number;
  open: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  nombre: string;
}) {
  const total = images.length;
  const ir = useCallback(
    (delta: -1 | 1) => onIndex((index + delta + total) % total),
    [index, total, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ir]);

  // Deslizar en móvil: se decide al soltar, con un umbral para que un toque
  // no cuente como pasar de foto.
  const inicioX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { inicioX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (inicioX.current === null) return;
    const dx = e.changedTouches[0].clientX - inicioX.current;
    inicioX.current = null;
    if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
  };

  /**
   * Clic fuera de la FOTO cierra. El contenido del diálogo ocupa la pantalla
   * entera, así que "fuera" no es fuera del diálogo: es fuera del rectángulo
   * que la imagen pinta de verdad dentro de su caja (`object-contain` deja
   * franjas transparentes que siguen siendo la <img>). Se calcula con el
   * tamaño natural de la imagen.
   */
  const clicFuera = (e: React.MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.querySelector("img");
    if (!caja) return onClose();
    const r = caja.getBoundingClientRect();
    const nw = caja.naturalWidth || 1;
    const nh = caja.naturalHeight || 1;
    const escala = Math.min(r.width / nw, r.height / nh);
    const w = nw * escala;
    const h = nh * escala;
    const x0 = r.left + (r.width - w) / 2;
    const y0 = r.top + (r.height - h) / 2;
    const dentro = e.clientX >= x0 && e.clientX <= x0 + w && e.clientY >= y0 && e.clientY <= y0 + h;
    if (!dentro) onClose();
  };

  const img = images[index];
  if (!img) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[80] bg-[rgba(10,10,12,0.92)] duration-300"
        className="z-[90] h-dvh w-screen max-w-none rounded-none border-none bg-transparent p-0 shadow-none duration-300 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{nombre} — foto {index + 1} de {total}</DialogTitle>

        <div className="relative flex h-full w-full flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* Barra superior: contador y cerrar */}
          <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <span className="text-[13px] tabular-nums opacity-80">{index + 1} / {total}</span>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
              <X className="size-5" />
            </button>
          </div>

          {/* La foto, con todo el espacio que quede. Clic fuera de ella, cierra. */}
          <div className="relative min-h-0 flex-1 px-2 pb-4 sm:px-16" onClick={clicFuera}>
            <Image
              key={img.url}
              src={img.url}
              alt={img.alt ?? nombre}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized
              priority
            />
          </div>

          {total > 1 && (
            <>
              <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior"
                className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:flex">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" onClick={() => ir(1)} aria-label="Foto siguiente"
                className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:flex">
                <ChevronRight className="size-6" />
              </button>

              {/* Miniaturas abajo, para saltar directo */}
              <div className="flex justify-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                {images.map((m, i) => (
                  <button key={m.url} type="button" onClick={() => onIndex(i)} aria-label={`Foto ${i + 1}`}
                    aria-current={i === index}
                    className={`relative size-12 overflow-hidden rounded-lg border-2 bg-[#1c1a1f] transition-opacity ${i === index ? "border-kora-coral" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <Image src={m.url} alt="" fill sizes="48px" className="object-contain" unoptimized />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
