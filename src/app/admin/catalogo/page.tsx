import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatCop } from "@/lib/format";
import { storage } from "@/modules/storage";
import { CategoryTile } from "@/modules/catalog/tiles";
import { ProductSheet } from "./product-sheet";
import { ImportSheet } from "./import-sheet";
import { CatalogToolbar } from "./catalog-toolbar";
import { StatusSwitch } from "./status-switch";
import { Pagination } from "../_components/pagination";
import type { ProductDraft } from "./product-form";

const PER_PAGE_OPTIONS = [20, 50, 100];
const DEFAULT_PER_PAGE = 20;

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

const GRID =
  "grid grid-cols-[2.4fr_1.2fr_1fr_0.8fr_1fr_0.6fr] items-center gap-3.5 px-6";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    nuevo?: string;
    editar?: string;
    importar?: string;
    q?: string;
    categoria?: string;
    estado?: string;
    por?: string;
    pagina?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");
  const canEdit = session.user.permissions.includes("catalog:edit");
  const canCreate = session.user.permissions.includes("catalog:create");
  const sp = await searchParams;
  const { nuevo, editar, importar, q, categoria, estado } = sp;

  const perPage = PER_PAGE_OPTIONS.includes(Number(sp.por))
    ? Number(sp.por)
    : DEFAULT_PER_PAGE;
  const page = Math.max(1, Number(sp.pagina) || 1);

  // Filtros del listado. El estado "agotado" se resuelve sobre las variantes
  // activas: un producto está agotado si ninguna tiene stock.
  const where: Record<string, unknown> = {};
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { brand: { contains: term, mode: "insensitive" } },
      { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
    ];
  }
  if (categoria) where.categoryId = categoria;
  if (estado === "activo") where.active = true;
  if (estado === "inactivo") where.active = false;
  if (estado === "agotado") {
    where.variants = { every: { OR: [{ active: false }, { stockActual: 0 }] } };
  }

  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: { include: { parent: true } },
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { position: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        parent: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Slide-over controlado por URL: ?nuevo=1 / ?editar=<id>
  let sheetInitial: ProductDraft | undefined;
  const editing = editar
    ? await db.product.findUnique({
        where: { id: editar },
        include: {
          variants: { orderBy: { createdAt: "asc" } },
          images: { orderBy: { position: "asc" } },
        },
      })
    : null;
  if (editing) {
    sheetInitial = {
      id: editing.id,
      name: editing.name,
      brand: editing.brand ?? "",
      categoryId: editing.categoryId,
      description: editing.description ?? "",
      active: editing.active,
      featured: editing.featured,
      images: editing.images.map((img) => ({
        id: img.id,
        url: storage().urlFor(img.url),
        alt: img.alt,
      })),
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
      <CatalogToolbar
        total={total}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentName: c.parent?.name ?? null,
        }))}
      />

      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div
          className={`${GRID} border-b border-[#f0ece6] py-4 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase`}
        >
          <span>Producto</span>
          <span>Categoría</span>
          <span>Precio</span>
          <span>Stock</span>
          <span>Estado</span>
          <span />
        </div>

        {products.map((p) => {
          const activeVariants = p.variants.filter((v) => v.active);
          const stock = activeVariants.reduce((s, v) => s + v.stockActual, 0);
          const low = activeVariants.some((v) => v.stockActual <= v.stockMin);
          const prices = activeVariants.map((v) => Number(v.priceCopOnline));
          const min = prices.length ? Math.min(...prices) : 0;
          // Con varios precios se muestra "Desde <el menor>": el rango obligaba
          // a leer dos cifras para entender desde cuánto arranca el producto.
          const variesPrice = new Set(prices).size > 1;
          const firstSku = activeVariants[0]?.sku ?? "—";
          const image = p.images[0];

          return (
            <div
              key={p.id}
              className={`${GRID} border-b border-[#f7f4f0] py-3.5 text-[13px] last:border-0 hover:bg-[#faf8f5]`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {image ? (
                  <div className="relative size-[42px] shrink-0 overflow-hidden rounded-[10px]">
                    <Image
                      src={storage().urlFor(image.url)}
                      alt={image.alt ?? p.name}
                      fill
                      sizes="42px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <CategoryTile color={p.category.color} icon={p.category.icon} size={42} />
                )}
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
                {variesPrice && (
                  <span className="mr-1 text-[11.5px] font-medium text-[#9aa0ab]">
                    Desde
                  </span>
                )}
                {formatCop(min)}
              </span>

              <span className="font-bold" style={{ color: low ? "#E5484D" : "#16181D" }}>
                {stock}
              </span>

              <span>
                {canEdit ? (
                  <StatusSwitch productId={p.id} active={p.active} />
                ) : (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={
                      p.active
                        ? { background: "#FFE9DD", color: "#FF5A1F" }
                        : { background: "#f0ece6", color: "#8a8f98" }
                    }
                  >
                    {p.active ? "Activo" : "Inactivo"}
                  </span>
                )}
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
          <div className="py-16 text-center">
            <PackageSearch className="mx-auto size-12 text-[#e2ddd6]" />
            <p className="mt-3 text-[15px] font-semibold text-kora-black">
              {total === 0 && !q && !categoria && !estado
                ? "Aún no hay productos"
                : "Ningún producto coincide"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {total === 0 && !q && !categoria && !estado
                ? "Usa “Nuevo producto” o “Importar Excel” para crear el primero."
                : "Prueba con otra búsqueda o quita los filtros."}
            </p>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={{ q, categoria, estado, por: sp.por }}
        basePath="/admin/catalogo"
      />

      {sheetOpen && (
        <ProductSheet categories={categoryTree(categories)} initial={sheetInitial} />
      )}

      {Boolean(importar) && canCreate && <ImportSheet />}
    </>
  );
}
