"use client";

// Carrusel automático de productos.
//
// Muestra `perView` elementos a la vez. Si hay más, avanza solo de página en
// página; con los que caben se comporta como una fila normal, sin controles
// ni movimiento. Se detiene mientras el cursor está encima para que nadie
// pierda de vista lo que estaba mirando.
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ROTATE_MS = 6000;

export function AutoCarousel({
  children,
  perView,
  gapClass = "gap-4",
  /** Controles claros sobre fondo oscuro (panel de ofertas). */
  tone = "light",
}: {
  children: React.ReactNode;
  perView: number;
  gapClass?: string;
  tone?: "light" | "dark";
}) {
  const items = Children.toArray(children);
  const pages = Math.ceil(items.length / perView);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => {
    setPage(next);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (pages < 2 || paused) return;
    const timer = setInterval(() => {
      setPage((current) => {
        const next = (current + 1) % pages;
        const track = trackRef.current;
        if (track) {
          track.scrollTo({ left: track.clientWidth * next, behavior: "smooth" });
        }
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [pages, paused]);

  const arrowCls =
    tone === "dark"
      ? "bg-white/90 text-kora-black hover:bg-white"
      : "bg-white text-kora-black shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-[#faf8f5]";

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        // `snap` mantiene las páginas alineadas si el visitante arrastra.
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: pages }, (_, p) => (
          <div
            key={p}
            className={`grid w-full shrink-0 snap-start ${gapClass}`}
            style={{ gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))` }}
          >
            {items.slice(p * perView, (p + 1) * perView)}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => goTo((page - 1 + pages) % pages)}
            className={`absolute top-1/2 -left-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${arrowCls}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => goTo((page + 1) % pages)}
            className={`absolute top-1/2 -right-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${arrowCls}`}
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="mt-3 flex justify-center gap-1.5">
            {Array.from({ length: pages }, (_, p) => (
              <button
                key={p}
                type="button"
                aria-label={`Ver página ${p + 1} de ${pages}`}
                aria-current={p === page}
                onClick={() => goTo(p)}
                className={`h-1.5 rounded-full transition-all ${
                  p === page
                    ? "w-5 bg-kora-coral"
                    : tone === "dark"
                      ? "w-1.5 bg-white/40 hover:bg-white/70"
                      : "w-1.5 bg-[#d9d4cc] hover:bg-[#b3b8c0]"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
