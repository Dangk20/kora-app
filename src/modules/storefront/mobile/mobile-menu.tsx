"use client";

// Menú lateral móvil (drawer desde la izquierda).
//
// En móvil las categorías salen del header —donde en escritorio ocupan una
// fila entera— y viven aquí. La barra inferior lleva la navegación principal;
// este menú lleva el catálogo por categoría, la cuenta y lo legal.
//
// Diseño: `../../../../../design-handoff/Kora-Movil-Prototipo.dc.html` §menú
// lateral. 320 px de ancho, cabecera oscura, filas de 48 px.

import { useMessages } from "@/modules/i18n/provider";
import { LanguageSwitch } from "@/app/(tienda)/language-switch";
import { useEffect } from "react";
import Link from "next/link";
import { MessageCircle, User, X } from "lucide-react";
import { LEGAL_LINKS } from "@/modules/legal/content";
import { CategoryTile, inkFor } from "@/modules/catalog/tiles";
import type { StoreCategory } from "../queries";

export function MobileMenu({
  open,
  onClose,
  categories,
  whatsappHref,
}: {
  open: boolean;
  onClose: () => void;
  categories: StoreCategory[];
  whatsappHref: string;
}) {
  const t = useMessages();
  // Con el menú abierto la página de detrás no debe desplazarse: si lo hace,
  // al cerrar apareces en un sitio distinto del que dejaste.
  useEffect(() => {
    if (!open) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [open]);

  // Escape cierra: es lo que espera cualquiera con teclado, y en móvil no
  // estorba.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 lg:hidden"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-[320px] max-w-[85vw] flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.movil.menu}
      >
        <div className="flex items-center justify-between bg-[#16181D] px-[18px] py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-kora.png" alt="KORA" className="h-[22px] w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.movil.cerrarMenu}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5">
          <p className="px-[18px] pt-3 pb-1.5 text-[10.5px] font-extrabold tracking-[1px] text-[#9aa0ab]">
            {t.movil.categorias}
          </p>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalogo?categoria=${c.slug}`}
              onClick={onClose}
              className="flex min-h-12 w-full items-center justify-between border-b border-[#f7f4f0] px-[18px] py-3.5"
            >
              <span className="flex items-center gap-3">
                {/* Pastel de fondo + tinta oscura, como el resto del sistema
                    (`CategoryTile` + `inkFor`). Una inicial blanca sobre pastel
                    no se lee, y aquí el color de categoría ya significa algo. */}
                <span
                  className="flex size-[34px] items-center justify-center overflow-hidden rounded-[10px]"
                  style={{ background: c.color, color: inkFor(c.color) }}
                  aria-hidden
                >
                  <CategoryTile color="transparent" icon={c.icon} size={34} radius={10} />
                </span>
                <span className="text-sm font-semibold text-kora-black">{c.name}</span>
              </span>
              <span className="text-[#c2bdb3]" aria-hidden>
                ›
              </span>
            </Link>
          ))}

          <p className="px-[18px] pt-4 pb-1.5 text-[10.5px] font-extrabold tracking-[1px] text-[#9aa0ab]">
            {t.movil.tuCuenta}
          </p>
          <Link
            href="/cuenta"
            onClick={onClose}
            className="flex min-h-[46px] items-center gap-3 px-[18px] py-3 text-sm font-semibold text-kora-black"
          >
            <User className="size-[18px]" />
            {t.movil.miCuenta}
          </Link>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[46px] items-center gap-3 px-[18px] py-3 text-sm font-semibold text-[#1FB57A]"
          >
            <MessageCircle className="size-[18px]" />
            {t.movil.escribenosWhatsapp}
          </a>

          {/* El idioma va en el menú y no en el header: en 360 px el header ya
              lleva marca, moneda, carrito y menú. Quien entra desde fuera ya
              lo tiene en inglés; esto es para cambiarlo. */}
          <div className="flex items-center justify-between px-[18px] pt-4 pb-1">
            <span className="text-[10.5px] font-extrabold tracking-[1px] text-[#9aa0ab]">
              {t.movil.idioma}
            </span>
            <LanguageSwitch tono="claro" />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2.5 border-t border-[#f0ece6] px-[18px] py-3.5">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                className="text-[11.5px] text-[#8a8f98]"
              >
                {t.layout.legales[l.href] ?? l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
