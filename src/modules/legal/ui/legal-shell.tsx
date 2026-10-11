// Marco del centro legal: cabecera de marca, lista de documentos y contenido.
//
// Referencia de maqueta: legal.twitch.com (pedido de Daniel, 10 oct 2026). El
// prototipo Kora.dc.html no tiene centro legal; de él se toman el contenedor,
// los radios y la tipografía, y de la marca el gradiente y los neutros. El
// morado de Twitch se sustituye por el negro del header de la tienda y el
// coral de KORA.
//
// Componente de servidor sin JavaScript propio: el selector de idioma y la
// lista móvil son <details>, que funcionan sin hidratar nada.

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, House } from "lucide-react";
import type { Locale } from "@/modules/i18n";
import { MESSAGES } from "@/modules/i18n/messages";
import { storeUrl } from "@/lib/site";
import type { LegalSlug } from "../content";
import { legalHref } from "../url";

type DocLink = { slug: LegalSlug; shortTitle: string };

type Props = {
  locale: Locale;
  enSubdominio: boolean;
  docs: DocLink[];
  /** Documento abierto; sin él, se está en el índice. */
  actual?: LegalSlug;
  children: React.ReactNode;
};

const IDIOMAS: { locale: Locale; nombre: string }[] = [
  { locale: "es", nombre: "Español" },
  { locale: "en", nombre: "English" },
];

export function LegalShell({ locale, enSubdominio, docs, actual, children }: Props) {
  const t = MESSAGES[locale].cuenta.legal;
  // Desde el subdominio "Volver a KORA" sale a la tienda; desde el propio host
  // de la tienda (desarrollo, pruebas) basta con la raíz.
  const tienda = enSubdominio ? storeUrl() : "/";

  const navDocs = (
    <ul>
      <li className="border-b border-[#e7e2dc]">
        <Link
          href={legalHref(enSubdominio, locale)}
          className={`flex items-center gap-2.5 px-4 py-4 text-[15px] font-bold ${actual ? "text-kora-black hover:text-kora-coral" : "text-kora-coral"}`}
        >
          <House className="size-[18px]" aria-hidden />
          {t.inicio}
        </Link>
      </li>
      {docs.map((d) => {
        const activo = d.slug === actual;
        return (
          <li key={d.slug} className="border-b border-[#e7e2dc]">
            <Link
              href={legalHref(enSubdominio, locale, d.slug)}
              aria-current={activo ? "page" : undefined}
              className={`block px-4 py-4 text-[15px] font-semibold ${
                activo ? "text-kora-coral underline underline-offset-4" : "text-kora-black hover:text-kora-coral"
              }`}
            >
              {d.shortTitle}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div lang={locale} className="flex min-h-screen flex-col bg-white text-kora-black">
      {/* Negro de la tienda (header de escritorio): el centro legal se lee como
          parte de KORA, no como otro sitio (Daniel, 10 oct). */}
      <header className="bg-[#16181D] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-[22px] py-6 sm:py-8">
          <Link href={legalHref(enSubdominio, locale)} className="flex items-end gap-2" aria-label={t.centroTitulo}>
            <Image src="/logo-kora.png" alt="KORA" width={140} height={36} className="h-8 w-auto sm:h-9" priority />
            <span className="font-accent text-[30px] leading-none text-kora-coral sm:text-[36px]">{t.marca}</span>
          </Link>

          <div className="flex items-center gap-3">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[12px] border border-[#3a3d45] px-4 py-2.5 text-[14.5px] font-semibold hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                {t.idioma}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="absolute right-0 z-20 mt-2 min-w-[160px] overflow-hidden rounded-[12px] bg-white py-1 text-kora-black shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
                {IDIOMAS.map((i) => (
                  <li key={i.locale}>
                    <Link
                      href={legalHref(enSubdominio, i.locale, actual)}
                      hrefLang={i.locale}
                      lang={i.locale}
                      aria-current={i.locale === locale ? "true" : undefined}
                      className={`block px-4 py-2.5 text-[14.5px] hover:bg-kora-beige ${i.locale === locale ? "font-bold text-kora-coral" : ""}`}
                    >
                      {i.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>

            <a
              href={tienda}
              className="flex items-center gap-1.5 rounded-[12px] bg-white px-4 py-2.5 text-[14.5px] font-semibold text-kora-black hover:opacity-90"
            >
              {t.volver}
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      {/* Móvil: la lista de documentos se pliega bajo la cabecera. */}
      <details className="border-b border-[#e7e2dc] bg-kora-beige lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-[22px] py-3.5 text-[14.5px] font-bold [&::-webkit-details-marker]:hidden">
          {t.documentos}
          <ChevronDown className="size-4" aria-hidden />
        </summary>
        <nav className="px-[6px] pb-2">{navDocs}</nav>
      </details>

      <div className="mx-auto flex w-full max-w-[1320px] flex-1">
        <aside className="hidden w-[300px] shrink-0 bg-kora-beige px-5 pt-10 lg:block">
          <nav aria-label={t.documentos} className="sticky top-6">
            {navDocs}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
