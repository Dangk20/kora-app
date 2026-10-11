// Cuerpo de un documento del centro legal: título, fecha, secciones con su
// resumen destacado e índice lateral.

import { Sparkles } from "lucide-react";
import type { Locale } from "@/modules/i18n";
import { MESSAGES } from "@/modules/i18n/messages";
import type { LegalBlock, LegalDocument } from "../content";
import { MARCAS_ACEPTADAS } from "../payments";
import { LegalToc } from "./toc";

/** Fecha ISO → "10 de octubre de 2026" / "October 10, 2026". */
export function fechaLarga(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale === "en" ? "en-US" : "es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "list") {
    return (
      <ul className="mt-3 space-y-2 pl-5">
        {block.items.map((item, i) => (
          <li key={i} className="list-disc text-[16px] leading-relaxed text-[#3c3c3c]">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "note") {
    return (
      <p className="mt-4 rounded-[12px] border-l-[3px] border-kora-coral bg-kora-beige px-4 py-3 text-[15px] leading-relaxed text-[#3c3c3c]">
        {block.text}
      </p>
    );
  }
  return <p className="mt-3 text-[16px] leading-relaxed text-[#3c3c3c]">{block.text}</p>;
}

/** Logotipos de las marcas aceptadas, a todo color y sin alterar. */
export function MarcasAceptadas({ titulo }: { titulo: string }) {
  return (
    <div className="mt-5">
      <p className="text-[13.5px] font-bold">{titulo}</p>
      <ul className="mt-2 flex flex-wrap gap-2.5">
        {MARCAS_ACEPTADAS.map((m) => (
          <li key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de public/, sin optimizar a propósito: los estándares de marca prohíben alterarlo */}
            <img src={m.logo} alt={m.nombre} width={62} height={40} className="h-10 w-auto rounded-[6px] border border-[#e7e2dc]" />
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  doc: LegalDocument;
  locale: Locale;
  /** Aviso de borrador cuando faltan datos de las sociedades (solo fuera de producción). */
  incompleto: boolean;
};

export function LegalDocumentView({ doc, locale, incompleto }: Props) {
  const t = MESSAGES[locale].cuenta.legal;
  const conMarcas = doc.slug === "seguridad-pagos" || doc.slug === "comercio";

  return (
    <div className="flex gap-10 px-[22px] py-10 lg:px-10 lg:py-14">
      <article className="min-w-0 max-w-[860px] flex-1">
        <h1 className="text-[30px] leading-tight font-extrabold sm:text-[40px]">{doc.title}</h1>
        <p className="mt-3 text-[14px] text-[#3c3c3c]">{t.actualizado(fechaLarga(doc.updatedAt, locale))}</p>
        <p className="mt-4 text-[17px] leading-relaxed text-[#3c3c3c]">{doc.summary}</p>

        {/* En desarrollo y pruebas los datos de las sociedades son
            marcadores. En producción esto nunca se renderiza: el proceso no
            habría arrancado (src/modules/legal/config.ts). */}
        {incompleto && (
          <p className="mt-6 rounded-[12px] border border-dashed border-[#d9534f] bg-[#fdf2f2] px-4 py-3 text-[14px] text-[#a33]">
            <strong>{t.borradorTitulo}</strong> {t.borrador}
          </p>
        )}

        {conMarcas && <MarcasAceptadas titulo={t.marcasAceptadas} />}

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-12 scroll-mt-6">
            <h2 className="text-[22px] leading-snug font-extrabold sm:text-[26px]">{s.heading}</h2>
            {s.summary && (
              <p className="mt-4 flex items-start gap-3.5 rounded-[14px] bg-kora-coral/10 px-5 py-4 text-[16px] leading-relaxed font-medium text-kora-black">
                <Sparkles className="mt-1 size-5 shrink-0 text-kora-coral" aria-hidden />
                <span>{s.summary}</span>
              </p>
            )}
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}
      </article>

      <aside className="hidden w-[300px] shrink-0 xl:block">
        <div className="sticky top-6">
          <LegalToc titulo={t.enEstaPagina} secciones={doc.sections.map((s) => ({ id: s.id, heading: s.heading }))} />
        </div>
      </aside>
    </div>
  );
}
