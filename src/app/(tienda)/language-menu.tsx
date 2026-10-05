"use client";

// El mundo del header abre el menú de idioma (pedido de Daniel, 5 oct 2026):
// la moneda se cambia a menudo y se queda a la mano como interruptor; el
// idioma casi nunca —la detección ya acierta— y un segundo interruptor junto
// a la moneda recargaba el header.
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Globe } from "lucide-react";
import { setLocale } from "@/modules/i18n/actions";
import { useLocale, useMessages } from "@/modules/i18n/provider";
import { LOCALES, type Locale } from "@/modules/i18n";

/** Cada idioma se nombra en sí mismo: quien no lee español debe reconocer "English". */
const NOMBRE: Record<Locale, string> = { es: "Español", en: "English" };

export function LanguageMenu() {
  const current = useLocale();
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const elegir = (l: Locale) => {
    setOpen(false);
    if (l !== current) startTransition(() => setLocale(l));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.comun.idioma}: ${NOMBRE[current]}`}
        disabled={pending}
        className="flex size-9 items-center justify-center rounded-full text-kora-orange transition-colors hover:bg-white/8 disabled:opacity-60"
      >
        <Globe className="size-5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.comun.idioma}
          className="absolute top-full left-1/2 z-50 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-[14px] bg-white py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
        >
          <p className="px-3.5 pt-1.5 pb-1 text-[10.5px] font-extrabold tracking-[1px] text-[#9aa0ab] uppercase">
            {t.comun.idioma}
          </p>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={l === current}
              lang={l}
              onClick={() => elegir(l)}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13.5px] hover:bg-[#faf8f5] ${
                l === current ? "font-bold text-kora-black" : "font-medium text-[#4a4f58]"
              }`}
            >
              {NOMBRE[l]}
              {l === current && <Check className="size-4 text-kora-coral" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
