// VITRINA — la página de inicio de la tienda, editable sobre sí misma.
//
// No hay formularios arriba y vista previa abajo: se ve la página real, a
// tamaño real, y cada sección trae un lápiz para editarla en el sitio.
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, MousePointerClick } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activeCurrency } from "@/modules/pricing/currency";
import {
  getBanners,
  getShowcase,
  getShowcaseCategories,
} from "@/modules/showcase/queries";
import { BANNER_SLOTS, SECTIONS } from "@/modules/showcase/sections";
import { StoreHomeLayout } from "@/modules/storefront/home-layout";
import { SectionEditControl } from "./edit-control";
import { BannerEditControl } from "./banner-control";

export default async function VitrinaPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");
  const canEdit = session.user.permissions.includes("catalog:edit");

  const currency = await activeCurrency();
  const [sections, banners, categories, categoryCount] = await Promise.all([
    getShowcase(currency),
    getBanners(),
    getShowcaseCategories(),
    db.category.count({ where: { active: true, parentId: null } }),
  ]);

  /** Devuelve el lápiz que corresponde a cada región de la página. */
  const editControl = canEdit
    ? (key: string) => {
        if (key.startsWith("banner:")) {
          const slot = key.slice("banner:".length);
          const def = BANNER_SLOTS.find((b) => b.slot === slot);
          if (!def) return null;
          return (
            <BannerEditControl def={def} banners={banners.get(def.slot) ?? []} />
          );
        }

        const def = SECTIONS.find((s) => s.key === key);
        const section = sections.find((s) => s.key === key);
        if (!def || !section) return null;
        return (
          <SectionEditControl
            def={def}
            categoryCount={categoryCount}
            section={{
              key: section.key,
              title: section.title,
              active: section.active,
              mode: section.mode,
              autoRule: section.autoRule,
              limit: section.limit,
              products: section.products.map((p) => ({
                id: p.id,
                name: p.name,
                imageUrl: p.images[0]?.url ?? null,
                categoryColor: p.category.color,
                categoryIcon: p.category.icon,
              })),
            }}
          />
        );
      }
    : undefined;

  // Las secciones ocultas o vacías no se pintan en la tienda, pero aquí sí
  // deben verse para poder volver a activarlas.
  const editableSections = sections.map((s) => ({ ...s, active: true }));
  const hiddenKeys = new Set(sections.filter((s) => !s.active).map((s) => s.key));

  return (
    <div className="-mx-8 -mt-6">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8e2] bg-white px-8 py-3.5">
        <p className="flex items-center gap-2 text-[13px] text-[#4a4f58]">
          <MousePointerClick className="size-4 shrink-0 text-kora-coral" />
          {canEdit ? (
            <>
              Esta es tu página de inicio. Pasa el cursor sobre una sección y usa el{" "}
              <strong className="text-kora-black">lápiz</strong> para editarla.
            </>
          ) : (
            "Vista de la página de inicio. No tienes permiso para editarla."
          )}
        </p>
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2 text-[13px] font-semibold text-kora-black hover:border-kora-coral"
        >
          <ExternalLink className="size-4" /> Abrir la tienda
        </Link>
      </div>

      {/* La página real, a tamaño completo */}
      <div className="bg-[#F5F3F0] px-2 pb-10">
        <StoreHomeLayout
          currency={currency}
          sections={editableSections.map((s) => ({
            ...s,
            title: hiddenKeys.has(s.key) ? s.title : s.title,
          }))}
          banners={banners}
          categories={categories}
          preview
          editControl={editControl}
        />
      </div>
    </div>
  );
}
