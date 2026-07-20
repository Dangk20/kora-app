// Chrome de la tienda pública: header sticky de dos filas + footer, como el
// prototipo aprobado (zona Tienda). El color y la tipografía vienen del manual.
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Search, User } from "lucide-react";
import { activeCurrency } from "@/modules/pricing/currency";
import { listCategories } from "@/modules/storefront/queries";
import { CartProvider } from "@/modules/cart/cart-context";
import { whatsappNumberFor } from "@/modules/orders/settings";
import { CurrencySwitch } from "./currency-switch";
import { CartButton } from "./cart-button";
import { CartDrawer } from "./cart-drawer";

/** `+573142751611` → `+57 314 275 1611` para mostrarlo en el header. */
function displayPhone(e164: string): string {
  const co = e164.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  if (co) return `+57 ${co[1]} ${co[2]} ${co[3]}`;
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`;
  return e164;
}

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currency, categories] = await Promise.all([
    activeCurrency(),
    listCategories(),
  ]);

  // Misma fuente que los pedidos: si cambia el destino, cambia en todas partes.
  const number = await whatsappNumberFor(currency);
  const WHATSAPP = {
    display: displayPhone(number),
    href: `https://api.whatsapp.com/send?phone=${number.replace(/\D/g, "")}`,
  };

  return (
    <CartProvider>
    <div className="flex min-h-screen flex-col bg-[#F5F3F0]">
      <header className="sticky top-0 z-50 bg-[#16181D]">
        {/* Fila 1: marca · buscador · moneda · cuenta · carrito */}
        <div className="mx-auto flex max-w-[1320px] items-center gap-5 px-[22px] py-3.5">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/logo-kora.png"
              alt="KORA"
              width={200}
              height={52}
              priority
              className="h-11 w-auto"
            />
          </Link>

          <form action="/catalogo" className="flex max-w-[560px] flex-1 items-center">
            <div className="flex w-full items-center rounded-full border border-[#2a2e36] bg-[#0E0F12] py-[5px] pr-[6px] pl-5">
              <input
                type="search"
                name="q"
                placeholder="Buscar productos, marcas y más…"
                aria-label="Buscar en la tienda"
                className="flex-1 bg-transparent text-[14.5px] text-[#F5F5F7] outline-none placeholder:text-[#6b7078]"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="bg-kora-gradient flex size-[42px] shrink-0 items-center justify-center rounded-full text-white hover:opacity-90"
              >
                <Search className="size-5" />
              </button>
            </div>
          </form>

          <CurrencySwitch current={currency} />

          {/* La cuenta de comprador llega con el módulo ACC. */}
          <div
            className="hidden items-center gap-2.5 text-[#6b7078] lg:flex"
            title="Disponible próximamente"
          >
            <User className="size-[21px]" aria-hidden />
            <div className="text-[11px] leading-tight">
              <p>Mi cuenta</p>
              <p className="font-semibold text-[#A0A4AD]">Próximamente</p>
            </div>
          </div>
          <CartButton />
        </div>

        {/* Fila 2: categorías reales del catálogo + línea de WhatsApp */}
        <nav className="border-t border-[#23262d]">
          <div className="mx-auto flex h-[46px] max-w-[1320px] items-center gap-1.5 px-[22px]">
            <Link
              href="/catalogo"
              className="py-2 pr-3.5 text-[13.5px] font-semibold text-[#F5F5F7] hover:text-white"
            >
              Todas las categorías
            </Link>
            <span className="mx-2 h-[18px] w-px bg-[#2a2e36]" aria-hidden />
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalogo?categoria=${c.slug}`}
                  className="shrink-0 px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap text-[#A0A4AD] hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
            </div>
            <a
              href={WHATSAPP.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex shrink-0 items-center gap-2.5 hover:opacity-85"
            >
              <span className="flex size-[34px] items-center justify-center rounded-full bg-white">
                <MessageCircle className="size-5 text-kora-orange" />
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-[10.5px] text-[#9aa0ab]">
                  Línea de WhatsApp
                </span>
                <span className="block text-[13px] font-bold text-white">
                  {WHATSAPP.display}
                </span>
              </span>
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0E0F12] px-[22px] py-10 text-[#A0A4AD]">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-kora.png"
              alt="KORA"
              width={140}
              height={36}
              className="h-7 w-auto"
            />
            <span className="text-xs">© 2026 · Todo lo que quieres, en un solo lugar</span>
          </div>
          <div className="flex items-center gap-6 text-[13px]">
            <a
              href={WHATSAPP.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Escríbenos por WhatsApp
            </a>
            <Link href="/login" className="hover:text-white">
              Acceso al equipo
            </Link>
          </div>
        </div>
      </footer>

      <CartDrawer />
    </div>
    </CartProvider>
  );
}
