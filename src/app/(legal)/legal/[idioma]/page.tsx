// Índice del centro legal: una tarjeta por documento.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/i18n";
import { MESSAGES } from "@/modules/i18n/messages";
import { merchant } from "@/modules/legal/config";
import { allLegalDocuments } from "@/modules/legal/content";
import { enSubdominioLegal } from "@/modules/legal/request";
import { MarcasAceptadas } from "@/modules/legal/ui/legal-document-view";
import { LegalPage } from "@/modules/legal/ui/legal-page";
import { legalHref } from "@/modules/legal/url";

// Interpola los datos de las sociedades desde el entorno: prerrenderizada,
// quedaría grabada con marcadores (el builder no recibe KORA_LEGAL_*).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ idioma: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idioma } = await params;
  if (!isLocale(idioma)) return {};
  const t = MESSAGES[idioma].cuenta.legal;
  return { title: t.centroTitulo, description: t.centroResumen };
}

export default async function LegalIndex({ params }: Props) {
  const { idioma } = await params;
  if (!isLocale(idioma)) notFound();

  const t = MESSAGES[idioma].cuenta.legal;
  const enSub = await enSubdominioLegal();
  const docs = allLegalDocuments(merchant(), idioma);

  return (
    <LegalPage locale={idioma}>
    <div className="px-[22px] py-10 lg:px-10 lg:py-14">
      <h1 className="text-[30px] leading-tight font-extrabold sm:text-[40px]">{t.centroTitulo}</h1>
      <p className="mt-4 max-w-[720px] text-[17px] leading-relaxed text-[#3c3c3c]">{t.centroResumen}</p>
      <MarcasAceptadas titulo={t.marcasAceptadas} />

      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {docs.map((d) => (
          <li key={d.slug} className="min-w-0">
            <Link
              href={legalHref(enSub, idioma, d.slug)}
              className="group flex h-full flex-col rounded-[16px] border border-[#e7e2dc] bg-white p-6 transition-colors hover:border-kora-coral"
            >
              <h2 className="text-[19px] font-extrabold">{d.title}</h2>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[#3c3c3c]">{d.summary}</p>
              <span className="mt-4 flex items-center gap-1.5 text-[14.5px] font-semibold text-kora-coral">
                {t.leer}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
    </LegalPage>
  );
}
