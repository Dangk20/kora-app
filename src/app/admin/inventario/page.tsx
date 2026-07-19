import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CategoryTile } from "@/modules/catalog/tiles";
import { StockSheet } from "./stock-sheet";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ajustar?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("inventory:view")) redirect("/admin");
  const canAdjust = session.user.permissions.includes("inventory:adjust");
  const { ajustar } = await searchParams;

  const variants = await db.variant.findMany({
    where: { active: true, product: { active: true } },
    include: { product: { include: { category: true } } },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
  });
  const lowCount = variants.filter((v) => v.stockActual <= v.stockMin).length;

  // Slide-over de ajuste controlado por URL (?ajustar=<variantId>)
  const adjusting = ajustar ? variants.find((v) => v.id === ajustar) : undefined;
  const movements = adjusting
    ? await db.stockMovement.findMany({
        where: { variantId: adjusting.id },
        include: { actor: true, order: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return (
    <>
      {/* Banner explicativo del prototipo */}
      <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-[#ffd9c7] bg-[linear-gradient(120deg,#FFF4EF,#fff)] px-5 py-4">
        <span className="bg-kora-coral flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-white">
          <Layers className="size-5" strokeWidth={1.8} />
        </span>
        <p className="text-[13px] leading-relaxed text-[#6b4a3a]">
          <span className="font-bold text-kora-black">Inventario unificado.</span>{" "}
          El stock es uno solo: la tienda online y el punto de venta físico venden
          del mismo inventario. Toda venta o ajuste queda registrado en el libro de
          movimientos — nada cambia el stock por fuera de él.
        </p>
      </div>

      {lowCount > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#fce8e8] px-5 py-3 text-[13px] font-semibold text-[#b3373b]">
          <Layers className="size-[18px]" strokeWidth={1.8} />
          {lowCount} variante(s) con stock en o por debajo de su alerta requieren
          reposición.
        </div>
      )}

      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[2.2fr_0.9fr_0.7fr_0.7fr_0.8fr_0.6fr_0.5fr] gap-3.5 border-b border-[#f0ece6] px-6 py-4 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
          <span>Producto · SKU</span>
          <span>Categoría</span>
          <span className="text-right">Online</span>
          <span className="text-right">Física</span>
          <span className="text-right">Stock total</span>
          <span className="text-right">Alerta</span>
          <span />
        </div>
        {variants.map((v) => {
          const low = v.stockActual <= v.stockMin;
          return (
            <div
              key={v.id}
              className="grid grid-cols-[2.2fr_0.9fr_0.7fr_0.7fr_0.8fr_0.6fr_0.5fr] items-center gap-3.5 border-b border-[#f7f4f0] px-6 py-3.5 text-[13px] hover:bg-[#faf8f5]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CategoryTile
                  color={v.product.category.color}
                  icon={v.product.category.icon}
                  size={42}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-kora-black">
                    {v.product.name}
                    {v.name !== "Única" && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {v.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[#9aa0ab]">SKU {v.sku}</div>
                </div>
              </div>
              <span className="text-muted-foreground">{v.product.category.name}</span>
              <span className="text-right font-semibold text-kora-coral">
                {v.onlineUnits}
              </span>
              <span className="text-right font-semibold text-[#8a5cb0]">
                {v.stockActual - v.onlineUnits}
              </span>
              <span
                className="text-right text-[15px] font-bold"
                style={{ color: low ? "#E5484D" : "#16181D" }}
              >
                {v.stockActual}
              </span>
              <span className="text-right text-muted-foreground">≤ {v.stockMin}</span>
              {canAdjust ? (
                <Link
                  href={`/admin/inventario?ajustar=${v.id}`}
                  className="justify-self-end rounded-lg bg-[#f5f3f0] px-3.5 py-2 text-[12.5px] font-semibold text-kora-black hover:bg-[#FFE9DD] hover:text-kora-coral"
                >
                  Ajustar
                </Link>
              ) : (
                <span />
              )}
            </div>
          );
        })}
        {variants.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay variantes activas todavía.
          </p>
        )}
      </div>

      {adjusting && canAdjust && (
        <StockSheet
          variant={{
            id: adjusting.id,
            productName: adjusting.product.name,
            variantName: adjusting.name,
            sku: adjusting.sku,
            stockActual: adjusting.stockActual,
            onlineUnits: adjusting.onlineUnits,
            stockMin: adjusting.stockMin,
            color: adjusting.product.category.color,
            icon: adjusting.product.category.icon,
          }}
          movements={movements.map((m) => ({
            id: m.id,
            delta: m.delta,
            reason: m.reason,
            channel: m.channel,
            actor: m.actor?.name ?? "Sistema",
            orderNumber: m.order?.number ?? null,
            note: m.note,
            createdAt: m.createdAt.toLocaleString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))}
        />
      )}
    </>
  );
}
