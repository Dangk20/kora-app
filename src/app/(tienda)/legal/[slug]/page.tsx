// Las tres páginas legales en una sola ruta.
//
// Un archivo y no tres `page.tsx` casi idénticos: tres serían tres sitios donde
// olvidar el mismo cambio de maqueta. El prototipo aprobado (Kora.dc.html) no
// tiene páginas legales, así que no hay sección equivalente que replicar; se
// siguen sus patrones del resto de la tienda: contenedor de 1320, tarjeta
// blanca redondeada sobre el fondo hueso, y la tipografía del manual.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { merchant } from "@/modules/legal/config";
import {
  allLegalDocuments,
  esSlugLegal,
  legalDocument,
  type LegalBlock,
} from "@/modules/legal/content";

// Son tres slugs conocidos y su contenido no toca la base, así que la tentación
// es prerrenderarlos. NO se puede: el texto interpola los datos del comerciante
// desde el entorno, y el builder del Dockerfile no recibe `KORA_LEGAL_*`.
// Prerrenderadas, las tres páginas quedarían grabadas con "[RAZÓN SOCIAL
// PENDIENTE]" para siempre — incluso en producción con las variables puestas.
// La guarda de arranque pasaría, el despliegue saldría verde, y la política
// publicada seguiría sin identificar al responsable del tratamiento.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!esSlugLegal(slug)) return {};

  const doc = legalDocument(slug, merchant());

  return {
    title: doc.title,
    description: doc.summary,
    // Una política legal no aporta nada en resultados de búsqueda y compite
    // con las fichas de producto, pero debe seguir siendo rastreable para que
    // los enlaces del footer y del checkout cuenten.
    robots: { index: false, follow: true },
  };
}

/** Fecha ISO → "7 de agosto de 2026". */
function fechaLarga(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-CO", {
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
          <li key={i} className="list-disc text-[15px] leading-relaxed text-[#4a4f58]">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === "note") {
    return (
      <p className="mt-4 rounded-[13px] border-l-[3px] border-kora-coral bg-[#FFF4EF] px-4 py-3 text-[14.5px] leading-relaxed text-[#4a4f58]">
        {block.text}
      </p>
    );
  }

  return <p className="mt-3 text-[15px] leading-relaxed text-[#4a4f58]">{block.text}</p>;
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!esSlugLegal(slug)) notFound();

  const m = merchant();
  const doc = legalDocument(slug, m);
  const otros = allLegalDocuments(m).filter((d) => d.slug !== slug);

  return (
    <main className="mx-auto w-full max-w-[1320px] px-[22px] py-8 lg:py-12">
      <div className="mx-auto max-w-[860px]">
        <nav className="mb-5 text-[13px] text-[#7c828c]">
          <Link href="/" className="hover:text-kora-black">
            Inicio
          </Link>
          <span className="mx-2">/</span>
          <span className="text-kora-black">{doc.title}</span>
        </nav>

        <article className="rounded-[18px] bg-white p-6 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-9 lg:p-11">
          <header className="border-b border-[#f0ece6] pb-6">
            <h1 className="text-[26px] leading-tight font-bold text-kora-black sm:text-[32px]">
              {doc.title}
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#5a6069]">{doc.summary}</p>
            <p className="mt-4 text-[13px] text-[#9aa0ab]">
              Última actualización: {fechaLarga(doc.updatedAt)}
            </p>
          </header>

          {/* En desarrollo los datos del comerciante son marcadores. En
              producción esto nunca se renderiza: el proceso no habría
              arrancado (src/modules/legal/config.ts). */}
          {m.incompleto && (
            <p className="mt-6 rounded-[13px] border border-dashed border-[#d9534f] bg-[#fdf2f2] px-4 py-3 text-[14px] text-[#a33]">
              <strong>Borrador:</strong> faltan los datos del comerciante (razón social, NIT,
              domicilio y correo de contacto). Este documento no puede publicarse así.
            </p>
          )}

          {doc.sections.map((section, i) => (
            <section key={i} className="mt-8">
              <h2 className="text-[18px] font-bold text-kora-black sm:text-[20px]">
                {section.heading}
              </h2>
              {section.blocks.map((block, j) => (
                <Block key={j} block={block} />
              ))}
            </section>
          ))}
        </article>

        <nav className="mt-6 flex flex-wrap gap-3">
          {otros.map((d) => (
            <Link
              key={d.slug}
              href={`/legal/${d.slug}`}
              className="rounded-full border border-[#e2ddd6] bg-white px-4 py-2.5 text-[13.5px] text-[#4a4f58] hover:border-kora-coral hover:text-kora-black"
            >
              {d.title}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
