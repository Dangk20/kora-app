import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginador de los listados del panel. Conserva búsqueda y filtros al
 * cambiar de página: lo que no viaja en la URL se pierde al navegar.
 */
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  params,
  basePath,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "pagina") next.set(key, value);
    }
    if (target > 1) next.set("pagina", String(target));
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  // Ventana de páginas alrededor de la actual: con 40 páginas no se pintan 40.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const boxCls =
    "flex h-9 min-w-9 items-center justify-center rounded-[9px] border-[1.6px] px-3 text-[13px] font-semibold transition-colors";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12.5px] text-[#8a8f98]">
        Mostrando {from}–{to} de {total}
      </p>

      <nav className="flex items-center gap-1.5" aria-label="Paginación">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            aria-label="Página anterior"
            className={`${boxCls} border-[#e2ddd6] bg-white text-kora-black hover:border-kora-coral`}
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={`${boxCls} border-[#f0ece6] bg-white text-[#d9d4cc]`}>
            <ChevronLeft className="size-4" />
          </span>
        )}

        {start > 1 && <span className="px-1 text-[13px] text-[#b3b8c0]">…</span>}

        {pages.map((p) =>
          p === page ? (
            <span
              key={p}
              aria-current="page"
              className={`${boxCls} border-transparent bg-kora-black text-white`}
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              className={`${boxCls} border-[#e2ddd6] bg-white text-kora-black hover:border-kora-coral`}
            >
              {p}
            </Link>
          ),
        )}

        {end < totalPages && <span className="px-1 text-[13px] text-[#b3b8c0]">…</span>}

        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            aria-label="Página siguiente"
            className={`${boxCls} border-[#e2ddd6] bg-white text-kora-black hover:border-kora-coral`}
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={`${boxCls} border-[#f0ece6] bg-white text-[#d9d4cc]`}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
