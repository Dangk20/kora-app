"use client";

// Vista del carrito (patrón del prototipo §8): lista de ítems + resumen
// sticky a la derecha. Los precios los resuelve el servidor en cada cambio.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { QuitarDelCarrito } from "@/modules/cart/quitar-boton";
import { useCart } from "@/modules/cart/cart-context";
import { getResolvedCart } from "@/modules/cart/actions";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { formatMoney } from "@/modules/pricing";
import { CategoryTile } from "@/modules/catalog/tiles";
import { useOwnsBottomBar } from "@/modules/storefront/mobile/bars-context";

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
      <div className="mx-auto flex max-w-[1140px] justify-center px-4 py-24 sm:px-[22px]">
        <Loader2 className="size-7 animate-spin text-[#b3b8c0]" />
      </div>
    );
  }

  const items = cart?.lines ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1140px] px-4 pt-6 pb-16 sm:px-[22px] sm:pt-8 sm:pb-20">
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
    <div className="mx-auto max-w-[1140px] px-4 pt-6 pb-16 sm:px-[22px] sm:pt-8 sm:pb-20">
      <h1 className="text-[30px] font-bold text-kora-black">Tu carrito</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-[#8a8f98]">
        {cart!.itemCount} {cart!.itemCount === 1 ? "producto" : "productos"}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((line) => (
            <div
              key={line.variantId}
              // En móvil los controles bajan a su propia línea: foto (84) +
              // cantidad (110) + total (104) + eliminar (36) más separaciones
              // suman más de lo que hay en 390 px, y la fila se salía por la
              // derecha llevándose el selector de cantidad fuera de pantalla.
              className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_3px_14px_rgba(0,0,0,0.04)] sm:flex-nowrap sm:gap-4 sm:p-4 ${
                line.unavailable ? "opacity-70" : ""
              }`}
            >
              <Link
                href={`/producto/${line.productSlug}`}
                className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl sm:size-[84px]"
                style={{ background: line.imageUrl ? "#f7f4f0" : line.categoryColor }}
              >
                {line.imageUrl ? (
                  <Image
                    src={line.imageUrl}
                    alt={line.productName}
                    fill
                    sizes="84px"
                    className="object-contain p-1.5"
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

              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
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
                <p className="text-right text-base font-bold text-kora-black sm:w-[104px]">
                  {formatMoney(line.lineTotal, currency)}
                </p>
              )}

              <QuitarDelCarrito
                nombre={line.productName}
                variante={line.variantName}
                onQuitar={() => remove(line.variantId)}
                className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#faf6f2] text-[#b3b8c0] hover:bg-[#fdecec] hover:text-destructive"
              />
              </div>
            </div>
          ))}
        </div>

        {/* En escritorio el resumen va pegado a la derecha. En móvil queda al
            final de la lista, así que el total y el botón se repiten en una
            barra inferior fija (ver más abajo): con seis artículos, llegar a
            "Continuar compra" exigía recorrer la página entera. */}
        <div className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6 lg:sticky lg:top-[140px]">
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

      <CarritoBarraMovil
        total={formatMoney(cart!.subtotal, currency)}
        currency={currency}
        habilitado={buyable.length > 0}
      />
    </div>
  );
}

/**
 * Total y botón, siempre a la vista en móvil.
 *
 * Sustituye a la barra de navegación mientras está el carrito con algo dentro:
 * dos barras fijas en 390 px dejan la lista sin sitio, y aquí la acción que
 * importa es una sola.
 */
function CarritoBarraMovil({
  total,
  currency,
  habilitado,
}: {
  total: string;
  currency: string;
  habilitado: boolean;
}) {
  useOwnsBottomBar(habilitado);

  if (!habilitado) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f0ece6] bg-white px-4 pt-3 lg:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-[#8a8f98]">Total</p>
          <p className="truncate text-[17px] leading-tight font-extrabold text-kora-black">
            {total} <span className="text-[12px] font-semibold text-[#8a8f98]">{currency}</span>
          </p>
        </div>
        <Link
          href="/checkout"
          className="bg-kora-gradient flex min-h-12 shrink-0 items-center gap-2 rounded-full px-6 text-[14.5px] font-bold text-white"
        >
          Continuar <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
