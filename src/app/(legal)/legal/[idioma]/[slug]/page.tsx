// Un documento del centro legal. La lógica vive en src/modules/legal/.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/i18n";
import { merchant } from "@/modules/legal/config";
import { esSlugLegal, legalDocument } from "@/modules/legal/content";
import { legalContext } from "@/modules/legal/request";
import { LegalDocumentView } from "@/modules/legal/ui/legal-document-view";
import { LegalPage } from "@/modules/legal/ui/legal-page";

// Ver la nota del índice: los datos de las sociedades salen del entorno.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ idioma: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idioma, slug } = await params;
  if (!isLocale(idioma) || !esSlugLegal(slug)) return {};
  const doc = legalDocument(slug, merchant(), idioma);
  return {
    title: doc.title,
    description: doc.summary,
    // Compite con las fichas de producto si se indexa; los enlaces sí cuentan.
    robots: { index: false, follow: true },
  };
}

export default async function LegalDocumentPage({ params }: Props) {
  const { idioma, slug } = await params;
  if (!isLocale(idioma) || !esSlugLegal(slug)) notFound();

  const m = merchant();
  const doc = legalDocument(slug, m, idioma, await legalContext(idioma));

  return (
    <LegalPage locale={idioma} actual={slug}>
      <LegalDocumentView doc={doc} locale={idioma} incompleto={m.incompleto} />
    </LegalPage>
  );
}
