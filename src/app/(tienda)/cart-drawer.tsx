"use client";

// Mini-carrito: panel lateral desde la derecha (patrón del prototipo §8).
// El ícono del header lo abre; desde aquí se va al carrito completo o
// directo a pagar. Nunca navega solo por hacer clic en el ícono.
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";
import { getResolvedCart } from "@/modules/cart/actions";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { formatMoney } from "@/modules/pricing";
import { CategoryTile } from "@/modules/catalog/tiles";

export function CartDrawer() {
  const { lines, ready, drawerOpen, closeDrawer, setQty, remove } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [loading, startLoading] = useTransition();

  // Se resuelve solo cuando el panel está abierto: no gastamos consultas
  // por cada visitante que nunca lo abre.
  useEffect(() => {
    if (!drawerOpen || !ready) return;
    startLoading(async () => setCart(await getResolvedCart(lines)));
  }, [drawerOpen, ready, lines]);

  if (!drawerOpen) return null;

  const items = cart?.lines ?? [];
  const currency = cart?.currency ?? "COP";
  const buyable = items.filter((l) => !l.unavailable);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-[rgba(14,15,18,0.5)]"
      onClick={closeDrawer}
      role="presentation"
    >
      <aside
        className="flex h-full w-[412px] max-w-full flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
      >
        <header className="flex items-center justify-between border-b border-[#f0ece6] px-6 py-5">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="size-[22px] text-kora-coral" />
            <h2 className="text-lg font-bold text-kora-black">Tu carrito</h2>
            {cart && cart.itemCount > 0 && (
              <span className="rounded-full bg-[#FFE9DD] px-2.5 py-0.5 text-xs font-bold text-kora-coral">
                {cart.itemCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar carrito"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        {loading && !cart ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#b3b8c0]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <ShoppingCart className="size-14 text-[#e2ddd6]" />
            <p className="mt-4 text-[17px] font-semibold text-kora-black">
              Tu carrito está vacío
            </p>
            <p className="mt-1 text-[13px] text-[#8a8f98]">
              Agrega productos y aparecerán aquí.
            </p>
            <Link
              href="/catalogo"
              onClick={closeDrawer}
              className="mt-5 rounded-full bg-kora-black px-5 py-3 text-[13.5px] font-bold text-white hover:bg-kora-orange"
            >
              Explorar productos
            </Link>
          </div>
        ) : (
          <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
            {items.map((line) => (
              <div key={line.variantId} className="flex gap-3">
                <Link
                  href={`/producto/${line.productSlug}`}
                  onClick={closeDrawer}
                  className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    background: line.imageUrl ? "#f7f4f0" : line.categoryColor,
                  }}
                >
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.productName}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <CategoryTile
                      color="transparent"
                      icon={line.categoryIcon}
                      size={64}
                      radius={0}
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/producto/${line.productSlug}`}
                    onClick={closeDrawer}
                    className="block truncate text-[13px] font-semibold text-kora-black hover:text-kora-coral"
                  >
                    {line.productName}
                  </Link>
                  <p className="truncate text-[11px] text-[#8a8f98]">
                    {line.variantName}
                  </p>

                  {line.unavailable ? (
                    <p className="mt-1 text-[11.5px] font-semibold text-destructive">
                      {line.onlineUnits === 0 ? "Agotado" : `No disponible en ${currency}`}
                    </p>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center overflow-hidden rounded-[9px] border border-[#e2ddd6]">
                        <button
                          type="button"
                          aria-label="Quitar una unidad"
                          onClick={() => setQty(line.variantId, line.qtyAvailable - 1)}
                          className="flex h-[30px] w-7 items-center justify-center hover:bg-[#faf8f5]"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-7 text-center text-[12.5px] font-bold">
                          {line.qtyAvailable}
                        </span>
                        <button
                          type="button"
                          aria-label="Agregar una unidad"
                          disabled={line.qtyAvailable >= line.onlineUnits}
                          onClick={() => setQty(line.variantId, line.qtyAvailable + 1)}
                          className="flex h-[30px] w-7 items-center justify-center hover:bg-[#faf8f5] disabled:opacity-40"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-kora-black">
                        {formatMoney(line.lineTotal, currency)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  aria-label={`Eliminar ${line.productName}`}
                  onClick={() => remove(line.variantId)}
                  className="flex size-[30px] shrink-0 items-start justify-center rounded-lg text-[#b3b8c0] hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <footer className="border-t border-[#f0ece6] px-5 py-4">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13.5px] font-semibold text-[#6b6f78]">Subtotal</span>
              <span className="text-[22px] font-extrabold text-kora-black">
                {formatMoney(cart?.subtotal ?? 0, currency)}
              </span>
            </div>
            <p className="mb-3.5 text-[11.5px] text-[#8a8f98]">
              El envío se acuerda contigo por WhatsApp al confirmar el pedido.
            </p>

            <Link
              href="/checkout"
              onClick={closeDrawer}
              aria-disabled={buyable.length === 0}
              className={`flex w-full items-center justify-center rounded-[13px] bg-kora-black px-6 py-3.5 text-[15px] font-bold text-white ${
                buyable.length === 0
                  ? "pointer-events-none opacity-45"
                  : "hover:bg-kora-orange"
              }`}
            >
              Ir a pagar
            </Link>
            <Link
              href="/carrito"
              onClick={closeDrawer}
              className="mt-2.5 flex w-full items-center justify-center rounded-[13px] border-[1.6px] border-[#e2ddd6] px-6 py-3 text-[14px] font-semibold text-kora-black hover:border-kora-coral"
            >
              Ver carrito completo
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
