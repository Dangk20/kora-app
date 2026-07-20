"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronRight, ShoppingCart } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";

/**
 * Botón de la card del catálogo.
 *
 * En una card no se puede elegir talla ni color, así que:
 *   - una sola variante → agrega directo al carrito;
 *   - varias variantes  → lleva a la ficha a elegir (patrón del prototipo §4.2).
 *
 * Vive dentro del <Link> de la card, por eso corta la propagación: hacer clic
 * en el botón no debe navegar a la ficha.
 */
export function AddToCartButton({
  variantId,
  productSlug,
  soldOut,
  needsChoice,
}: {
  variantId: string | null;
  productSlug: string;
  soldOut: boolean;
  needsChoice: boolean;
}) {
  const router = useRouter();
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (needsChoice || !variantId) {
      router.push(`/producto/${productSlug}`);
      return;
    }
    add(variantId, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const label = soldOut
    ? "Agotado"
    : added
      ? "Agregado"
      : needsChoice
        ? "Ver opciones"
        : "Agregar";

  // Negro de marca por defecto; naranja de marca al agregar.
  // El hover NO usa naranja a propósito: si lo hiciera, pasar el cursor se
  // vería igual que la confirmación y el comprador no sabría si ya agregó.
  const tone = soldOut
    ? "cursor-not-allowed bg-[#f0ece6] text-[#8a8f98]"
    : added
      ? "bg-kora-orange text-white"
      : "bg-kora-black text-white hover:bg-kora-gray-dark";

  const Icon = added ? Check : needsChoice ? ChevronRight : ShoppingCart;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={soldOut}
      aria-label={soldOut ? "Producto agotado" : label}
      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] px-4 py-3 text-[13.5px] font-bold transition-colors ${tone}`}
    >
      {!soldOut && <Icon className="size-[18px] shrink-0" />}
      <span>{label}</span>
    </button>
  );
}
