"use client";

// Piezas pequeñas que comparten los tres pasos del constructor.

import type { Segment } from "@/modules/campaigns/types";

export const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-kora-coral";
export const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

export const ACTIVIDAD: { value: Segment["activity"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos_30", label: "Compraron en 30 días" },
  { value: "activos_60", label: "Compraron en 60 días" },
  { value: "activos_90", label: "Compraron en 90 días" },
  { value: "inactivos_90", label: "Sin comprar hace +90 días" },
  { value: "sin_compras", label: "Nunca han comprado" },
];

export function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</h3>
        {nota && <span className="text-[11.5px] text-muted-foreground">{nota}</span>}
      </div>
      {children}
    </section>
  );
}

export function ErrorTexto({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[12px] text-destructive">{children}</p>;
}

export function Suave({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-[#9aa0ab]">{children}</span>;
}

/** Lo que describe la audiencia con palabras, para el resumen del último paso. */
export function describirSegmento(s: Segment, categorias: { id: string; name: string }[]): string {
  const pais = s.country === "ambos" ? "Colombia y EE.UU." : s.country === "CO" ? "Colombia" : "Estados Unidos";
  const act = ACTIVIDAD.find((a) => a.value === s.activity)?.label ?? "Todos";
  const cuenta = s.account === "todos" ? "" : s.account === "con_cuenta" ? " · con cuenta" : " · invitados";
  const cats = s.categoryIds.length
    ? " · compraron " + s.categoryIds.map((id) => categorias.find((c) => c.id === id)?.name ?? "").filter(Boolean).join(", ")
    : "";
  return `${pais} · ${act.toLowerCase()}${cuenta}${cats}`;
}
