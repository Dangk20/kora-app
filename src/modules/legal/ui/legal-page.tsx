// Marco + datos comunes de una página del centro legal. Lo usan el índice y
// cada documento: el marco necesita saber QUÉ documento está abierto (para
// marcarlo y para que el cambio de idioma lleve al mismo), y un layout de Next
// no recibe ese segmento.
import { merchant } from "../config";
import { allLegalDocuments, type LegalSlug } from "../content";
import type { Locale } from "@/modules/i18n";
import { enSubdominioLegal } from "../request";
import { LegalShell } from "./legal-shell";

export async function LegalPage({
  locale,
  actual,
  children,
}: {
  locale: Locale;
  actual?: LegalSlug;
  children: React.ReactNode;
}) {
  const docs = allLegalDocuments(merchant(), locale).map((d) => ({ slug: d.slug, shortTitle: d.shortTitle }));
  return (
    <LegalShell locale={locale} enSubdominio={await enSubdominioLegal()} docs={docs} actual={actual}>
      {children}
    </LegalShell>
  );
}
