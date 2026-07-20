// Página de inicio de la tienda. Toda su estructura y contenido salen del
// módulo Vitrina: esta página solo pide los datos y los pinta.
import { Flame } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import {
  getBanners,
  getShowcase,
  getShowcaseCategories,
} from "@/modules/showcase/queries";
import { StoreHomeLayout } from "@/modules/storefront/home-layout";
import { CONTAINER } from "@/modules/storefront/home-sections";

export default async function StoreHome() {
  const currency = await activeCurrency();
  const [sections, banners, categories] = await Promise.all([
    getShowcase(currency),
    getBanners(),
    getShowcaseCategories(),
  ]);

  const hasContent = sections.some((s) => s.active && s.products.length > 0);
  if (!hasContent) {
    return (
      <section className={`${CONTAINER} py-20`}>
        <div className="rounded-[20px] bg-white p-16 text-center">
          <Flame className="mx-auto size-14 text-[#e2ddd6]" />
          <p className="mt-4 text-lg font-semibold text-kora-black">
            Estamos cargando el catálogo
          </p>
          <p className="mt-1 text-[13.5px] text-[#8a8f98]">
            Muy pronto vas a encontrar aquí todos nuestros productos.
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
    />
  );
}
