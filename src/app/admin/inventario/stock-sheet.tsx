"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { adjustStock } from "@/modules/inventory/actions";
import { CategoryTile } from "@/modules/catalog/tiles";

const REASONS = [
  { value: "AJUSTE_MANUAL", label: "Ajuste manual (conteo físico)" },
  { value: "COMPRA_INICIAL", label: "Entrada de mercancía" },
  { value: "DEVOLUCION", label: "Devolución" },
  { value: "MERMA", label: "Merma / daño / pérdida" },
];

const REASON_LABEL: Record<string, string> = {
  COMPRA_INICIAL: "Entrada",
  VENTA_ONLINE: "Venta online",
  VENTA_POS: "Venta POS",
  AJUSTE_MANUAL: "Ajuste",
  DEVOLUCION: "Devolución",
  MERMA: "Merma",
  RESERVA: "Reserva",
  LIBERACION_RESERVA: "Liberación",
};

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

type Movement = {
  id: string;
  delta: number;
  reason: string;
  channel: string;
  actor: string;
  orderNumber: number | null;
  note: string | null;
  createdAt: string;
};

export function StockSheet({
  variant,
  movements,
}: {
  variant: {
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    stockActual: number;
    onlineUnits: number;
    stockMin: number;
    color: string;
    icon: string;
  };
  movements: Movement[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(adjustStock, null);
  const close = () => router.push("/admin/inventario");

  // Controlados para poder DERIVAR las unidades de tienda mientras se escribe.
  const [total, setTotal] = useState(String(variant.stockActual));
  const [online, setOnline] = useState(String(variant.onlineUnits));
  const enTienda = Math.max(0, (Number(total) || 0) - (Number(online) || 0));

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      router.push("/admin/inventario");
    }
  }, [state, router]);

  return (
    // Modal CENTRADO y en dos columnas, no panel lateral: el ajuste se decide
    // mirando el historial —"¿esto ya lo conté ayer?"—, y en 440 px el
    // formulario y los movimientos no caben a la vez, así que había que
    // desplazar para comparar lo que se está escribiendo con lo que pasó.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,15,18,0.5)] p-4 sm:p-8"
      onClick={close}
    >
      <div
        className="flex h-[min(88vh,720px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-20px_rgba(14,15,18,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0ece6] bg-white px-6 py-5">
          <h2 className="text-lg font-bold text-kora-black">Ajustar stock</h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <div className="mb-5 flex items-center gap-3">
            <CategoryTile color={variant.color} icon={variant.icon} size={48} radius={12} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-kora-black">
                {variant.productName}
                {variant.variantName !== "Única" && ` · ${variant.variantName}`}
              </div>
              <div className="text-xs text-muted-foreground">SKU {variant.sku}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-extrabold text-kora-black">
                {variant.stockActual}
              </div>
              <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
                en stock
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
          <form action={formAction} className="h-fit space-y-3.5 rounded-xl border-[1.6px] border-[#eee9e2] p-4">
            <input type="hidden" name="variantId" value={variant.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="target">Stock total</label>
                <input
                  id="target"
                  name="target"
                  type="number"
                  min="0"
                  step="1"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  required
                  className={`${inputCls} text-right tabular-nums`}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="onlineTarget">Unidades online</label>
                <input
                  id="onlineTarget"
                  name="onlineTarget"
                  type="number"
                  min="0"
                  step="1"
                  value={online}
                  onChange={(e) => setOnline(e.target.value)}
                  required
                  className={`${inputCls} text-right tabular-nums`}
                />
              </div>

              {/* Unidades de tienda: se VE, no se escribe.
                  Es un dato DERIVADO —total menos online—, y darle su propio
                  campo editable crearía una tercera cifra que puede
                  contradecir a las otras dos. Enseñarlo sí importa: el
                  operador está repartiendo un mismo inventario entre dos
                  canales, y sin ver la otra mitad decide a ciegas. Se
                  recalcula mientras escribe, así que el reparto se entiende
                  antes de aplicarlo. */}
              <div className="col-span-2">
                <label className={labelCls} htmlFor="enTienda">
                  Unidades en tienda física{" "}
                  <span className="font-normal text-[#9aa0ab]">
                    (se calcula: total − online)
                  </span>
                </label>
                <input
                  id="enTienda"
                  value={enTienda}
                  readOnly
                  disabled
                  aria-describedby="enTienda-ayuda"
                  className={`${inputCls} cursor-not-allowed border-dashed bg-[#faf8f5] text-right font-semibold tabular-nums text-[#6b6f78]`}
                />
              </div>
            </div>

            {(Number(online) || 0) > (Number(total) || 0) && (
              <p role="alert" className="text-[12px] font-semibold text-destructive">
                Las unidades online no pueden superar el stock total.
              </p>
            )}
            <p id="enTienda-ayuda" className="text-[11px] leading-relaxed text-muted-foreground">
              Es un solo inventario: lo que no publiques online queda para la
              tienda física. Si el POS vende unidades asignadas a online, el cupo
              se recorta solo — la caja nunca se bloquea.
            </p>
            <div>
              <label className={labelCls} htmlFor="reason">Motivo</label>
              <select id="reason" name="reason" required className={`${inputCls} bg-white`}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="note">Nota (opcional)</label>
              <input
                id="note"
                name="note"
                placeholder="Ej. conteo físico de fin de mes"
                className={inputCls}
              />
            </div>
            {state && !state.ok && (
              <p className="text-sm font-semibold text-destructive">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="bg-kora-gradient w-full rounded-[11px] py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,31,0.3)] hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Aplicando…" : "Aplicar ajuste"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              El ajuste entra como un movimiento al libro contable — el historial
              está al lado.
            </p>
          </form>

          <div className="min-h-0 lg:overflow-y-auto">
            <div className="mb-2.5 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
              Últimos movimientos
            </div>
            <div className="space-y-2">
              {movements.length === 0 && (
                <p className="text-[12.5px] text-[#b3b8c0]">Sin movimientos aún.</p>
              )}
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg bg-[#faf8f5] px-3 py-2.5 text-[12.5px]"
                >
                  <span
                    className="w-12 shrink-0 text-center text-sm font-extrabold"
                    // Entradas en morado de marca, salidas en gris oscuro:
                    // el kardex no necesita semáforo, necesita distinguirse.
                    style={{ color: m.delta > 0 ? "#7A3DB8" : "#3C3C3C" }}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-kora-black">
                      {REASON_LABEL[m.reason] ?? m.reason}
                      {m.orderNumber && ` · KORA-${String(m.orderNumber).padStart(6, "0")}`}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {m.createdAt} · {m.actor}
                      {m.note && ` · ${m.note}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
