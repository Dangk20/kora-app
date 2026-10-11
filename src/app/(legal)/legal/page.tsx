// Raíz del centro legal: lleva al índice en el idioma del visitante, con la
// misma precedencia que la tienda (cookie > origen por IP > español).
import { redirect } from "next/navigation";
import { activeLocale } from "@/modules/i18n/server";
import { enSubdominioLegal } from "@/modules/legal/request";
import { legalHref } from "@/modules/legal/url";

export const dynamic = "force-dynamic";

export default async function LegalRoot() {
  redirect(legalHref(await enSubdominioLegal(), await activeLocale()));
}
