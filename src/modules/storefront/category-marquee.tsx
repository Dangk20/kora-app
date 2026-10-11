"use client";

// Fila de categorías del header de escritorio. Con el catálogo real las
// categorías ya no caben en una línea y la fila mostraba una barra de
// desplazamiento gris. Ahora se desplaza sola, despacio, y se detiene con el
// cursor encima o con el foco del teclado (pedido de Daniel, 11 oct 2026).
//
// - Si caben, no se mueve: un carrusel sin nada oculto solo marea.
// - Para dar la vuelta sin salto, la lista se duplica y al pasar la mitad se
//   vuelve al inicio; la copia va `aria-hidden` y fuera del orden de tabulación.
// - Con "reducir movimiento" activado en el sistema no se anima: queda con
//   desplazamiento manual (rueda o arrastre), sin barra visible.
// - Se mueve con requestAnimationFrame sobre scrollLeft, no con transform: así
//   el desplazamiento manual sigue funcionando y se retoma desde donde quedó.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Píxeles por segundo. Lento a propósito: se tiene que poder leer. */
const VELOCIDAD = 22;

export function CategoryMarquee({ items }: { items: { href: string; label: string }[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const copiaRef = useRef<HTMLDivElement>(null);
  const pausado = useRef(false);
  const [desborda, setDesborda] = useState(false);

  // ¿Hay categorías ocultas? Se recalcula al cambiar el ancho de la ventana.
  useEffect(() => {
    const v = viewport.current;
    const p = pista.current;
    if (!v || !p) return;
    // Se mide la lista ORIGINAL: con la copia puesta, la pista siempre desborda.
    const original = p.firstElementChild as HTMLElement | null;
    const medir = () => setDesborda((original?.scrollWidth ?? 0) > v.clientWidth + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(v);
    ro.observe(p);
    return () => ro.disconnect();
  }, [items]);

  useEffect(() => {
    const v = viewport.current;
    if (!v || !desborda) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let antes = performance.now();
    let acumulado = v.scrollLeft;
    const paso = (ahora: number) => {
      const dt = Math.min(ahora - antes, 100);
      antes = ahora;
      if (!pausado.current) {
        // Una vuelta = hasta donde empieza la copia (lista + separación).
        const vuelta = copiaRef.current?.offsetLeft ?? v.scrollWidth / 2;
        acumulado = (acumulado + (VELOCIDAD * dt) / 1000) % vuelta;
        v.scrollLeft = acumulado;
      } else {
        // Al reanudar, desde donde lo dejó la persona (si lo movió a mano).
        acumulado = v.scrollLeft;
      }
      frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [desborda]);

  const lista = (copia: boolean) =>
    items.map((c) => (
      <Link
        key={`${copia ? "b" : "a"}-${c.href}`}
        href={c.href}
        tabIndex={copia ? -1 : undefined}
        className="shrink-0 px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap text-[#A0A4AD] hover:text-white"
      >
        {c.label}
      </Link>
    ));

  return (
    <div
      ref={viewport}
      onMouseEnter={() => (pausado.current = true)}
      onMouseLeave={() => (pausado.current = false)}
      onFocus={() => (pausado.current = true)}
      onBlur={() => (pausado.current = false)}
      className="relative min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={
        desborda
          ? {
              maskImage: "linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent)",
            }
          : undefined
      }
    >
      <div ref={pista} className="flex w-max items-center gap-1">
        <div className="flex items-center gap-1">{lista(false)}</div>
        {desborda && (
          <div ref={copiaRef} className="flex items-center gap-1" aria-hidden>
            {lista(true)}
          </div>
        )}
      </div>
    </div>
  );
}
