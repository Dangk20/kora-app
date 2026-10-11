"use client";

// Índice "En esta página" con la sección visible marcada, como en la
// referencia. Funciona sin JavaScript (son anclas); el observador solo añade
// la marca de la sección en curso.

import { useEffect, useState } from "react";

type Props = {
  titulo: string;
  secciones: { id: string; heading: string }[];
};

export function LegalToc({ titulo, secciones }: Props) {
  const [activa, setActiva] = useState(secciones[0]?.id);

  useEffect(() => {
    const visibles = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visibles.set(e.target.id, e.isIntersecting);
        // La primera sección, en orden de documento, que esté en la franja.
        const primera = secciones.find((s) => visibles.get(s.id));
        if (primera) setActiva(primera.id);
      },
      // Franja superior de la pantalla: una sección "está" cuando su título
      // ha pasado la cabecera pero aún no salió por arriba.
      { rootMargin: "-10% 0px -70% 0px" },
    );
    for (const s of secciones) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [secciones]);

  return (
    <nav aria-label={titulo}>
      <p className="mb-3 text-[13.5px] font-bold tracking-wide uppercase">{titulo}</p>
      <ol className="space-y-1 rounded-[14px] bg-kora-beige px-3 py-4">
        {secciones.map((s) => {
          const on = s.id === activa;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                className={`block border-l-2 px-3 py-1.5 text-[14px] leading-snug ${
                  on ? "border-kora-coral font-semibold text-kora-coral" : "border-transparent text-[#3c3c3c] hover:text-kora-black"
                }`}
              >
                {s.heading}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
