"use client";

// Vista del carrito (patrón del prototipo §8): lista de ítems + resumen
// sticky a la derecha. Los precios los resuelve el servidor en cada cambio.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";
import { getResolvedCart } from "@/modules/cart/actions";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { formatMoney } from "@/modules/pricing";
import { CategoryTile } from "@/modules/catalog/tiles";

export function CartView() {
  const { lines, ready, setQty, remove } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!ready) return;
    startLoading(async () => {
      setCart(await getResolvedCart(lines));
    });
  }, [lines, ready]);

  if (!ready || (loading && !cart)) {
    return (
      <div className="mx-auto flex max-w-[1140px] justify-center px-[22px] py-24">
        <Loader2 className="size-7 animate-spin text-[#b3b8c0]" />
      </div>
    );
  }

  const items = cart?.lines ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1140px] px-[22px] pt-8 pb-20">
        <h1 className="mb-6 text-[30px] font-bold text-kora-black">Tu carrito</h1>
        <div className="rounded-[20px] bg-white p-16 text-center">
          <ShoppingCart className="mx-auto size-16 text-[#e2ddd6]" />
          <p className="mt-4 text-[19px] font-semibold text-kora-black">
            Tu carrito está vacío
          </p>
          <p className="mt-1 text-[13.5px] text-[#8a8f98]">
            Explora el catálogo y encuentra productos increíbles.
          </p>
          <Link
            href="/catalogo"
            className="bg-kora-gradient mt-6 inline-block rounded-full px-6 py-3.5 text-[14px] font-bold text-white hover:opacity-90"
          >
            Explorar productos
          </Link>
        </div>
      </div>
    );
  }

  const currency = cart!.currency;
  const buyable = items.filter((l) => !l.unavailable);

  return (
    <div className="mx-auto max-w-[1140px] px-[22px] pt-8 pb-20">
      <h1 className="text-[30px] font-bold text-kora-black">Tu carrito</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-[#8a8f98]">
        {cart!.itemCount} {cart!.itemCount === 1 ? "producto" : "productos"}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((line) => (
            <div
              key={line.variantId}
              className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_3px_14px_rgba(0,0,0,0.04)] ${
                line.unavailable ? "opacity-70" : ""
              }`}
            >
              <Link
                href={`/producto/${line.productSlug}`}
                className="relative flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{ background: line.imageUrl ? "#f7f4f0" : line.categoryColor }}
              >
                {line.imageUrl ? (
                  <Image
                    src={line.imageUrl}
                    alt={line.productName}
                    fill
                    sizes="84px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <CategoryTile
                    color="transparent"
                    icon={line.categoryIcon}
                    size={84}
                    radius={0}
                  />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/producto/${line.productSlug}`}
                  className="block truncate text-[14.5px] font-semibold text-kora-black hover:text-kora-coral"
                >
                  {line.productName}
                </Link>
                <p className="text-xs text-[#8a8f98]">
                  {line.variantName} · SKU {line.sku}
                </p>
                {line.unavailable ? (
                  <p className="mt-1 text-[12.5px] font-semibold text-destructive">
                    {line.onlineUnits === 0
                      ? "Agotado en la tienda online"
                      : `No disponible en ${currency}`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[13px] text-[#4a4f58]">
                    {formatMoney(line.unitPrice, currency)} c/u
                    {line.hasOnlineDiscount && (
                      <span className="ml-1.5 text-[11.5px] text-[#b3b8c0] line-through">
                        {formatMoney(line.storeUnitPrice, currency)}
                      </span>
                    )}
                  </p>
                )}
                {!line.unavailable && line.qtyAvailable < line.qty && (
                  <p className="mt-1 text-[12px] font-semibold text-kora-coral">
                    Solo quedan {line.onlineUnits}; ajustamos la cantidad.
                  </p>
                )}
              </div>

              {!line.unavailable && (
                <div className="flex items-center overflow-hidden rounded-[10px] border-[1.6px] border-[#e2ddd6]">
                  <button
                    type="button"
                    aria-label="Quitar una unidad"
                    onClick={() => setQty(line.variantId, line.qtyAvailable - 1)}
                    className="flex h-[38px] w-9 items-center justify-center hover:bg-[#faf8f5]"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-bold">
                    {line.qtyAvailable}
                  </span>
                  <button
                    type="button"
                    aria-label="Agregar una unidad"
                    disabled={line.qtyAvailable >= line.onlineUnits}
                    onClick={() => setQty(line.variantId, line.qtyAvailable + 1)}
                    className="flex h-[38px] w-9 items-center justify-center hover:bg-[#faf8f5] disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              )}

              {!line.unavailable && (
                <p className="w-[104px] text-right text-base font-bold text-kora-black">
                  {formatMoney(line.lineTotal, currency)}
                </p>
              )}

              <button
                type="button"
                aria-label={`Eliminar ${line.productName}`}
                onClick={() => remove(line.variantId)}
                className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#faf6f2] text-[#b3b8c0] hover:bg-[#fdecec] hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-[18px] bg-white p-6 shadow-[0_4px_18px_rgba(0,0,0,0.04)] lg:sticky lg:top-[140px]">
          <h2 className="mb-4 text-[17px] font-bold text-kora-black">Resumen</h2>
          <div className="flex justify-between text-sm text-[#4a4f58]">
            <span>Subtotal</span>
            <span className="font-semibold">
              {formatMoney(cart!.subtotal, currency)}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8a8f98]">
            El costo de envío se acuerda contigo por WhatsApp al confirmar el
            pedido.
          </p>

          <div className="my-4 h-px bg-[#efe9e1]" />

          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold text-kora-black">Total</span>
            <span className="text-2xl font-extrabold text-kora-black">
              {formatMoney(cart!.subtotal, currency)} {currency}
            </span>
          </div>

          <Link
            href="/checkout"
            aria-disabled={buyable.length === 0}
            className={`bg-kora-gradient mt-5 flex items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] ${
              buyable.length === 0
                ? "pointer-events-none opacity-45 shadow-none"
                : "hover:opacity-90"
            }`}
          >
            Continuar compra <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/catalogo"
            className="mt-3 block text-center text-[13px] font-semibold text-[#8a8f98] hover:text-kora-black"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
