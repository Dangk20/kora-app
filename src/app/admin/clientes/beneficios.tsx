"use client";

// Beneficios del cliente en su ficha (change beneficios): la ruleta de la
// apertura y los que el administrador otorga a mano. Vigencia de 30 días.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import type { BenefitKind } from "@/generated/prisma/client";
import type { BeneficioCliente } from "@/modules/benefits/benefits";
import { otorgarBeneficioAdmin } from "@/modules/benefits/actions";

export type OpcionesBeneficio = {
  categorias: { id: string; name: string }[];
  productos: { id: string; label: string }[];
};

const TIPOS: { kind: BenefitKind; label: string }[] = [
  { kind: "CASHBACK", label: "Cashback de regalo" },
  { kind: "DESCUENTO_CATEGORIA", label: "Descuento en una categoría" },
  { kind: "PRODUCTO_GRATIS", label: "Producto de regalo" },
];

const ESTADO = {
  VIGENTE: "bg-[#e8f6ec] text-[#1f7a3d]",
  USADO: "bg-[#f0ece6] text-[#6b6f78]",
  VENCIDO: "bg-[#f4f2ef] text-[#a3a7af]",
} as const;

const fecha = (d: Date) => new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

export function Beneficios({
  customerId,
  beneficios,
  opciones,
  puedeOtorgar,
}: {
  customerId: string;
  beneficios: BeneficioCliente[];
  opciones: OpcionesBeneficio | null;
  puedeOtorgar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<BenefitKind>("CASHBACK");
  const [valor, setValor] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const otorgar = () =>
    start(async () => {
      setError(null);
      const r = await otorgarBeneficioAdmin({
        customerId,
        kind,
        amount: kind === "PRODUCTO_GRATIS" ? undefined : Number(valor.replace(/\D/g, "")),
        categoryId: kind === "DESCUENTO_CATEGORIA" ? categoryId : undefined,
        variantId: kind === "PRODUCTO_GRATIS" ? variantId : undefined,
      });
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      setValor("");
      router.refresh();
    });

  const campo = "w-full rounded-[10px] border border-[#e6e1da] bg-white px-3 py-2 text-sm text-kora-black outline-none focus:border-[#FF5A1F]";

  return (
    <div className="rounded-[12px] border border-[#eee9e2] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Gift className="size-4 text-[#FF5A1F]" /> Beneficios
        </div>
        {puedeOtorgar && opciones && !abierto && (
          <button onClick={() => setAbierto(true)} className="text-[12.5px] font-semibold text-[#FF5A1F] hover:underline">
            Otorgar beneficio
          </button>
        )}
      </div>

      {abierto && opciones && (
        <div className="mt-3 space-y-2.5 rounded-[10px] bg-[#fbfaf8] p-3">
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.kind}
                onClick={() => setKind(t.kind)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  kind === t.kind ? "bg-kora-black text-white" : "bg-white text-[#6b6f78] ring-1 ring-[#e6e1da]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {kind === "CASHBACK" && (
            <input
              inputMode="numeric"
              placeholder="Valor en pesos, ej. 10.000"
              value={valor ? `$${Number(valor.replace(/\D/g, "")).toLocaleString("es-CO")}` : ""}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
              className={campo}
            />
          )}
          {kind === "DESCUENTO_CATEGORIA" && (
            <div className="flex gap-2">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={campo}>
                <option value="">Categoría…</option>
                {opciones.categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                inputMode="numeric"
                placeholder="%"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className={`${campo} w-20`}
              />
            </div>
          )}
          {kind === "PRODUCTO_GRATIS" && (
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={campo}>
              <option value="">Producto…</option>
              {opciones.productos.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
          <p className="text-[11.5px] text-muted-foreground">Vence en 30 días. Se usa una sola vez.</p>
          {error && <p className="text-[12px] font-semibold text-[#c2410c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setAbierto(false)} className="rounded-[10px] px-3 py-2 text-[13px] text-[#6b6f78]">
              Cancelar
            </button>
            <button
              onClick={otorgar}
              disabled={pending}
              className="bg-kora-gradient rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Otorgando…" : "Otorgar"}
            </button>
          </div>
        </div>
      )}

      {beneficios.length === 0 ? (
        !abierto && <p className="mt-2 text-[12.5px] text-muted-foreground">Todavía no tiene beneficios.</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {beneficios.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
              <div className="min-w-0">
                <div className="truncate font-semibold text-kora-black">{b.title}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {b.source === "RULETA" ? "Ruleta" : "Otorgado"} ·{" "}
                  {b.estado === "USADO"
                    ? `usado${b.usedOrderNumber ? ` en el pedido ${b.usedOrderNumber}` : ""}`
                    : `${b.estado === "VENCIDO" ? "venció" : "vence"} el ${fecha(b.expiresAt)}`}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[b.estado]}`}>
                {b.estado === "VIGENTE" ? "Vigente" : b.estado === "USADO" ? "Usado" : "Vencido"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
