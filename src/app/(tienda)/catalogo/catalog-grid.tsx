"use client";

// Rejilla del catálogo con "Cargar más" que AGREGA al final, sin navegar: la
// página no se recarga ni sube, y el botón muestra que está trabajando.
//
// Sin JavaScript el botón sigue siendo un enlace a `?ver=` (la página lo
// entiende), y tras cargar se actualiza la URL para que siga siendo
// compartible y el "atrás" no pierda lo cargado.
import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cargarMasProductos } from "./load-more-action";

export function CatalogGrid({
  children,
  mostradosIniciales,
  quedanIniciales,
  filtros,
}: {
  children: ReactNode;
  mostradosIniciales: number;
  quedanIniciales: number;
  filtros: { categoria?: string; q?: string; orden?: string };
}) {
  const [extras, setExtras] = useState<ReactNode[]>([]);
  const [mostrados, setMostrados] = useState(mostradosIniciales);
  const [quedan, setQuedan] = useState(quedanIniciales);
  const [error, setError] = useState(false);
  const [cargando, startTransition] = useTransition();

  const url = (ver: number) => {
    const next = new URLSearchParams();
    if (filtros.categoria) next.set("categoria", filtros.categoria);
    if (filtros.q) next.set("q", filtros.q);
    if (filtros.orden) next.set("orden", filtros.orden);
    next.set("ver", String(ver));
    return `/catalogo?${next}`;
  };

  const cargarMas = () =>
    startTransition(async () => {
      setError(false);
      try {
        const r = await cargarMasProductos({ ...filtros, desde: mostrados });
        setExtras((prev) => [...prev, r.tarjetas]);
        setMostrados(r.mostrados);
        setQuedan(r.quedan);
        // Solo la URL, sin navegar: que se pueda compartir y volver.
        window.history.replaceState(window.history.state, "", url(r.mostrados));
      } catch {
        setError(true);
      }
    });

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {children}
        {extras}
      </div>

      {quedan > 0 && (
        <div className="mt-8 text-center">
          <a
            href={url(mostrados + 12)}
            onClick={(e) => {
              e.preventDefault();
              if (!cargando) cargarMas();
            }}
            aria-busy={cargando}
            aria-disabled={cargando}
            className={`inline-flex min-h-12 min-w-[180px] items-center justify-center gap-2 rounded-full border-[1.8px] border-kora-black px-7 text-[14px] font-bold transition-colors ${
              cargando
                ? "cursor-wait bg-kora-black text-white"
                : "bg-white text-kora-black hover:bg-kora-black hover:text-white"
            }`}
          >
            {cargando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cargando…
              </>
            ) : (
              `Cargar más (${quedan})`
            )}
          </a>
          {error && (
            <p className="mt-3 text-[13px] text-destructive">
              No se pudieron cargar más productos. Intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
