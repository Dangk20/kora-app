"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";

/**
 * Ícono de carrito del header (patrón del prototipo §3). Abre el panel
 * lateral; no navega — ver el carrito no debe sacarte de donde estabas.
 */
export function CartButton() {
  const { count, ready, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Abrir carrito${count > 0 ? `: ${count} artículos` : " (vacío)"}`}
      className="relative flex size-[46px] shrink-0 items-center justify-center rounded-[13px] border border-[#2a2e36] bg-[#0E0F12] text-[#F5F5F7] hover:border-kora-coral"
    >
      <ShoppingCart className="size-[22px]" />
      {ready && count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-[21px] min-w-[21px] items-center justify-center rounded-full border-2 border-[#16181D] bg-kora-coral px-1 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
