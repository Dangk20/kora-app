"use client";

// Chrome móvil de la tienda: header que se oculta al bajar, banda de búsqueda
// siempre visible, y barra inferior fija de 4 accesos.
//
// Construido contra `../../../../../design-handoff/Kora-Movil-Spec.dc.html` §01
// y su prototipo. Los valores (alturas, pesos, colores) salen de ahí, no de
// criterio propio: el encargo del 7 ago es replicar ese diseño.
//
// Por qué el chrome móvil es un componente aparte y no el de escritorio con
// clases responsive: son dos navegaciones distintas, no una adaptada. La de
// escritorio tiene barra de categorías y línea de WhatsApp en el header; la
// móvil mueve las categorías a un menú lateral y la navegación a una barra
// inferior. Intentar que un solo árbol sirva a las dos produce marcado que
// ninguna de las dos necesita, y en móvil eso se paga en peso.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";
import type { Currency } from "@/modules/pricing";
import { setCurrency } from "@/modules/pricing/currency-actions";
import { NAV_ITEMS } from "./nav-items";

/** Alto de la barra inferior sin contar el área segura de iOS. */
const NAV_H = 56;

/**
 * ¿Debe verse el header negro?
 *
 * Se oculta al bajar y reaparece al subir. El umbral evita que un temblor de
 * dedo lo haga parpadear: sin él, cualquier micro-desplazamiento alterna el
 * estado y el header vibra mientras se lee.
 */
function useHideOnScroll(threshold = 8): boolean {
  const [visible, setVisible] = useState(true);
  const ultimo = useRef(0);

  useEffect(() => {
    ultimo.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - ultimo.current;

      if (Math.abs(delta) < threshold) return;

      // Cerca del tope siempre visible: si no, al volver arriba de un tirón el
      // header puede quedarse escondido con la página ya en el principio.
      setVisible(y < 80 || delta < 0);
      ultimo.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return visible;
}

export function MobileHeader({
  currency,
  onOpenMenu,
}: {
  currency: Currency;
  onOpenMenu: () => void;
}) {
  const visible = useHideOnScroll();
  const { count, ready, openDrawer } = useCart();
  const router = useRouter();
  const [q, setQ] = useState("");

  const buscar = () => {
    const termino = q.trim();
    router.push(termino ? `/catalogo?q=${encodeURIComponent(termino)}` : "/catalogo");
  };

  return (
    <header className="sticky top-0 z-40 lg:hidden">
      {/* Fila negra: se oculta al bajar. La banda de búsqueda de abajo NO,
          porque buscar es la acción que más se repite en un catálogo. */}
      <div
        className={`bg-[#16181D] transition-[max-height,opacity] duration-200 ease-out ${
          visible ? "max-h-20 opacity-100" : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="flex items-center gap-[9px] px-3.5 py-[11px]">
          <Link href="/" className="flex flex-1 items-center gap-[7px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-kora.png" alt="KORA" className="h-[26px] w-auto" />
          </Link>

          <div className="flex rounded-full bg-white/8 p-0.5" role="group" aria-label="Moneda">
            {(["COP", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === currency}
                onClick={() => c !== currency && setCurrency(c)}
                className={`rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold ${
                  c === currency ? "bg-white text-kora-black" : "text-[#A0A4AD]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Abrir carrito${count > 0 ? `: ${count} artículos` : " (vacío)"}`}
            className="relative flex size-[38px] items-center justify-center rounded-full bg-white/8 text-white"
          >
            <ShoppingCart className="size-[19px]" />
            {ready && count > 0 && (
              <span className="bg-kora-gradient absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#16181D] text-[10px] font-extrabold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menú"
            className="flex min-h-[38px] items-center gap-1.5 text-[12.5px] font-bold text-white"
          >
            <Menu className="size-[19px]" />
            Menú
          </button>
        </div>
      </div>

      {/* Banda de marca con el buscador: siempre visible. */}
      <div className="bg-kora-gradient px-3.5 py-[11px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="flex min-h-[44px] items-center rounded-full bg-white py-1 pr-1 pl-4"
        >
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar productos, marcas…"
            aria-label="Buscar en la tienda"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-kora-black outline-none placeholder:text-[#9aa0ab]"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="bg-kora-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Search className="size-[17px]" />
          </button>
        </form>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count, ready } = useCart();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#f0ece6] bg-white px-1.5 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden"
      // El área segura de iOS se suma al relleno inferior: sin esto, en un
      // iPhone con barra de gestos los cuatro accesos quedan debajo de ella.
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map((item) => {
        const activo = item.match(pathname);
        const Icono = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-[3px]"
          >
            <Icono
              className="size-[22px]"
              // El activo va relleno, como en el diseño.
              fill={activo ? "currentColor" : "none"}
              strokeWidth={activo ? 1.5 : 1.8}
              color={activo ? "#ff5a1f" : "#8a8f98"}
            />
            <span
              className={`text-[10.5px] ${
                activo ? "font-extrabold text-kora-coral" : "font-semibold text-[#8a8f98]"
              }`}
            >
              {item.label}
            </span>

            {item.href === "/carrito" && ready && count > 0 && (
              <span className="bg-kora-gradient absolute top-0.5 right-1/2 -mr-[22px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full text-[9.5px] font-extrabold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Hueco que la barra inferior le roba al contenido.
 *
 * Sin esto, el último elemento de cada página queda tapado — y en el carrito o
 * el checkout lo último es justamente el botón que cierra la compra.
 */
export function MobileNavSpacer() {
  return (
    <div
      aria-hidden
      className="lg:hidden"
      style={{ height: `calc(${NAV_H}px + env(safe-area-inset-bottom))` }}
    />
  );
}
