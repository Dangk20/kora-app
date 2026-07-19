import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatCop } from "@/lib/format";
import { CategoryTile } from "@/modules/catalog/tiles";
import { ProductSheet } from "./product-sheet";
import type { ProductDraft } from "./product-form";

function categoryTree(cats: { id: string; name: string; parentId: string | null }[]) {
  return cats
    .filter((c) => !c.parentId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      children: cats
        .filter((c) => c.parentId === p.id)
        .map((c) => ({ id: c.id, name: c.name })),
    }));
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string; editar?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");
  const canEdit = session.user.permissions.includes("catalog:edit");
  const canCreate = session.user.permissions.includes("catalog:create");
  const { nuevo, editar } = await searchParams;

  const [products, categories] = await Promise.all([
    db.product.findMany({
      include: {
        category: { include: { parent: true } },
        variants: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  // Slide-over controlado por URL: ?nuevo=1 / ?editar=<id>
  let sheetInitial: ProductDraft | undefined;
  const editing = editar ? products.find((p) => p.id === editar) : undefined;
  if (editing) {
    sheetInitial = {
      id: editing.id,
      name: editing.name,
      brand: editing.brand ?? "",
      categoryId: editing.categoryId,
      description: editing.description ?? "",
      active: editing.active,
      featured: editing.featured,
      variants: editing.variants
        .filter((v) => v.active)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          barcode: v.barcode ?? "",
          priceCopStore: String(v.priceCopStore),
          priceCopOnline: String(v.priceCopOnline),
          priceUsdStore: String(v.priceUsdStore),
          priceUsdOnline: String(v.priceUsdOnline),
          stockMin: String(v.stockMin),
          initialStock: "0",
          active: v.active,
          stockActual: v.stockActual,
        })),
    };
  }
  const sheetOpen = (Boolean(nuevo) && canCreate) || (Boolean(editing) && canEdit);

  return (
    <>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[2.4fr_1.2fr_1fr_0.8fr_0.8fr_0.6fr] gap-3.5 border-b border-[#f0ece6] px-6 py-4 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
          <span>Producto</span>
          <span>Categoría</span>
          <span>Precio online</span>
          <span>Stock</span>
          <span>Estado</span>
          <span />
        </div>
        {products.map((p) => {
          const activeVariants = p.variants.filter((v) => v.active);
          const stock = activeVariants.reduce((s, v) => s + v.stockActual, 0);
          const low = activeVariants.some((v) => v.stockActual <= v.stockMin);
          const soldOut = stock === 0;
          const prices = activeVariants.map((v) => Number(v.priceCopOnline));
          const min = prices.length ? Math.min(...prices) : 0;
          const max = prices.length ? Math.max(...prices) : 0;
          const firstSku = activeVariants[0]?.sku ?? "—";
          const estado = !p.active
            ? { label: "Inactivo", bg: "#f0ece6", color: "#8a8f98" }
            : soldOut
              ? { label: "Agotado", bg: "#fce8e8", color: "#E5484D" }
              : { label: "Activo", bg: "#e1f6ee", color: "#1FB57A" };

          return (
            <div
              key={p.id}
              className="grid grid-cols-[2.4fr_1.2fr_1fr_0.8fr_0.8fr_0.6fr] items-center gap-3.5 border-b border-[#f7f4f0] px-6 py-3.5 text-[13px] hover:bg-[#faf8f5]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CategoryTile color={p.category.color} icon={p.category.icon} size={42} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-kora-black">{p.name}</div>
                  <div className="text-[11.5px] text-[#9aa0ab]">
                    {p.brand ? `${p.brand} · ` : ""}SKU {firstSku}
                    {activeVariants.length > 1 && ` +${activeVariants.length - 1}`}
                  </div>
                </div>
              </div>
              <span className="text-muted-foreground">
                {p.category.parent
                  ? `${p.category.parent.name} › ${p.category.name}`
                  : p.category.name}
              </span>
              <span className="font-bold text-kora-black">
                {min === max ? formatCop(min) : `${formatCop(min)} – ${formatCop(max)}`}
              </span>
              <span
                className="font-bold"
                style={{ color: low ? "#E5484D" : "#16181D" }}
              >
                {stock}
              </span>
              <span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: estado.bg, color: estado.color }}
                >
                  {estado.label}
                </span>
              </span>
              {canEdit ? (
                <Link
                  href={`/admin/catalogo?editar=${p.id}`}
                  className="justify-self-end rounded-lg bg-[#f5f3f0] px-3.5 py-2 text-[12.5px] font-semibold text-kora-black hover:bg-[#FFE9DD] hover:text-kora-coral"
                >
                  Editar
                </Link>
              ) : (
                <span />
              )}
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aún no hay productos. Usa “Nuevo producto” arriba para crear el primero.
          </p>
        )}
      </div>

      {sheetOpen && (
        <ProductSheet
          categories={categoryTree(categories)}
          initial={sheetInitial}
        />
      )}
    </>
  );
}
