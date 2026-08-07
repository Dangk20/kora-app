"use client";

// Carrusel automático de productos.
//
// **En escritorio:** muestra `perView` elementos a la vez y avanza solo de
// página en página. Con los que caben se comporta como una fila normal, sin
// controles ni movimiento. Se detiene mientras el cursor está encima para que
// nadie pierda de vista lo que estaba mirando.
//
// **En móvil:** deja de paginar y pasa a desplazamiento libre con *peek* — la
// tarjeta siguiente se ve a medias, que es lo que le dice al pulgar que hay
// más (diseño móvil §02). Repartir `perView` columnas en 390 px daría
// tarjetas de 80 px donde no cabe ni el precio; y las flechas y los puntos se
// ocultan, porque en táctil se arrastra.
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ROTATE_MS = 6000;

export function AutoCarousel({
  children,
  perView,
  gapRem = 1,
  /**
   * Cuántos se ven a la vez en móvil. Con decimales a propósito: 1.35 deja la
   * siguiente tarjeta asomando un tercio, que es el *peek*.
   */
  perViewMobile = 1.35,
  /** Controles claros sobre fondo oscuro (panel de ofertas). */
  tone = "light",
}: {
  children: React.ReactNode;
  perView: number;
  /** Separación entre elementos, en rem. UNA fuente: alimenta el `gap` y el
   *  cálculo del ancho. Con dos, el ancho deja de cuadrar y el último elemento
   *  se corta un poco — el defecto más difícil de ver de un carrusel. */
  gapRem?: number;
  perViewMobile?: number;
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
      // `min-w-0` no es decorativo: un hijo de grid o flex tiene
      // `min-width: auto`, así que el contenido que se desborda ESTIRA su
      // columna. Sin esto, el carrusel ensancha la celda, el título de al lado
      // se maqueta a un ancho mayor que el panel, y el panel —que recorta— se
      // lo come. Se vio con "Ofertas que están encendidas" partido a la mitad.
      className="relative min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        // Los elementos van planos, no agrupados en páginas: así el ancho de
        // cada uno puede cambiar por punto de corte. `snap-start` mantiene la
        // alineación cuando se arrastra.
        //
        // `snap-mandatory` solo en escritorio: en móvil, con peek, obliga a
        // encajar la tarjeta a medias y pelea contra el dedo.
        className="flex gap-[var(--gap)] overflow-x-auto scroll-smooth md:snap-x md:snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={
          {
            "--pv": perView,
            "--pv-m": perViewMobile,
            "--gap": `${gapRem}rem`,
          } as React.CSSProperties
        }
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="w-[calc((100%-var(--gap)*(var(--pv-m)-1))/var(--pv-m))] shrink-0 snap-start md:w-[calc((100%-var(--gap)*(var(--pv)-1))/var(--pv))]"
          >
            {item}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => goTo((page - 1 + pages) % pages)}
            className={`absolute top-1/2 -left-3 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors md:flex ${arrowCls}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => goTo((page + 1) % pages)}
            className={`absolute top-1/2 -right-3 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors md:flex ${arrowCls}`}
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="mt-3 hidden justify-center gap-1.5 md:flex">
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
