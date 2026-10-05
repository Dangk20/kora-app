"use client";

// Selector de idioma ES | EN, gemelo del de moneda (change
// `tienda-en-ingles`). La elección se guarda y prevalece sobre la detección.
import { useTransition } from "react";
import { setLocale } from "@/modules/i18n/actions";
import { useLocale, useMessages } from "@/modules/i18n/provider";
import { LOCALES } from "@/modules/i18n";

export function LanguageSwitch({ tono = "oscuro" }: { tono?: "oscuro" | "claro" }) {
  const current = useLocale();
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full p-0.5 ${tono === "oscuro" ? "bg-[#0E0F12]" : "bg-[#f5f3f0]"}`}
      role="group"
      aria-label={t.comun.idioma}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== current && startTransition(() => setLocale(l))}
          disabled={pending}
          aria-pressed={l === current}
          lang={l}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase transition-colors disabled:opacity-60 ${
            l === current
              ? "bg-kora-gradient text-white"
              : tono === "oscuro"
                ? "text-[#A0A4AD] hover:text-white"
                : "text-[#6b6f78] hover:text-kora-black"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
