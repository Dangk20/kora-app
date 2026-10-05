// Página de inicio de la tienda. Toda su estructura y contenido salen del
// módulo Vitrina: esta página solo pide los datos y los pinta.
import type { Metadata } from "next";
import { activeLocale } from "@/modules/i18n/server";
import { MESSAGES } from "@/modules/i18n/messages";
import { Flame } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import {
  getBanners,
  getShowcase,
  getShowcaseCategories,
} from "@/modules/showcase/queries";
import { StoreHomeLayout } from "@/modules/storefront/home-layout";
import { CONTAINER } from "@/modules/storefront/home-sections";
import { storeMetadata } from "@/modules/storefront/metadata";

// Generada por petición: el título y la descripción siguen el idioma del visitante.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await activeLocale();
  const t = MESSAGES[locale].tienda.meta;
  return storeMetadata({ title: t.titulo, description: t.descripcion, path: "/", locale });
}

export default async function StoreHome() {
  const currency = await activeCurrency();
  const locale = await activeLocale();
  const [sections, banners, categories] = await Promise.all([
    getShowcase(currency, locale),
    getBanners(),
    getShowcaseCategories(8, locale),
  ]);

  const t = MESSAGES[locale].tienda;
  const hasContent = sections.some((s) => s.active && s.products.length > 0);
  if (!hasContent) {
    return (
      <section className={`${CONTAINER} py-20`}>
        <div className="rounded-[20px] bg-white p-16 text-center">
          <Flame className="mx-auto size-14 text-[#e2ddd6]" />
          <p className="mt-4 text-lg font-semibold text-kora-black">
            {t.cargandoCatalogo}
          </p>
          <p className="mt-1 text-[13.5px] text-[#8a8f98]">
            {t.muyPronto}
          </p>
        </div>
      </section>
    );
  }

  return (
    <StoreHomeLayout
      currency={currency}
      sections={sections}
      banners={banners}
      categories={categories}
      locale={locale}
    />
  );
}
