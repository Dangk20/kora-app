"use client";

import { Printer } from "lucide-react";

export function ImprimirRecibo() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-kora-gradient flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold text-white hover:opacity-90"
    >
      <Printer className="size-4" /> Imprimir
    </button>
  );
}
