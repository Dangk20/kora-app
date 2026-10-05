"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMessages } from "@/modules/i18n/provider";

const OPTIONS = ["relevancia", "precioAsc", "precioDesc", "nombre"] as const;

/** Selector de orden del prototipo (§5): conserva los demás parámetros. */
export function SortSelect({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useMessages().catalogo;

  return (
    <label className="flex items-center gap-2.5">
      <span className="text-[13px] text-[#8a8f98]">{t.ordenarPor}</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("orden", e.target.value);
          router.push(`/catalogo?${next}`);
        }}
        className="rounded-[10px] border border-[#e2ddd6] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-kora-black outline-none focus:border-kora-coral"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {t.orden[o]}
          </option>
        ))}
      </select>
    </label>
  );
}
