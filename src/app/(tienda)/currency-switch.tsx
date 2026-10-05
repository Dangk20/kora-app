"use client";

import { useTransition } from "react";
import { setCurrency } from "@/modules/pricing/currency-actions";
import type { Currency } from "@/modules/pricing";
import { useMessages } from "@/modules/i18n/provider";
import { LanguageMenu } from "./language-menu";

/**
 * Selector de moneda del header (TIE_HU001 §2). El prototipo tiene aquí un
 * selector de país; el alcance real son dos divisas, así que se conserva el
 * patrón visual (ícono + label pequeño + valor) con COP/USD.
 */
export function CurrencySwitch({ current }: { current: Currency }) {
  const [pending, startTransition] = useTransition();
  const t = useMessages();

  const choose = (currency: Currency) => {
    if (currency === current) return;
    startTransition(() => {
      setCurrency(currency);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* El mundo es el menú de idioma; la moneda sigue a la mano al lado. */}
      <LanguageMenu />
      <div>
        <p className="text-[11px] leading-tight text-[#6b7078]">{t.comun.verPreciosEn}</p>
        <div
          className="mt-0.5 flex items-center gap-0.5 rounded-full bg-[#0E0F12] p-0.5"
          role="group"
          aria-label={t.comun.moneda}
        >
          {(["COP", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => choose(c)}
              disabled={pending}
              aria-pressed={c === current}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                c === current
                  ? "bg-kora-gradient text-white"
                  : "text-[#A0A4AD] hover:text-white"
              } disabled:opacity-60`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
