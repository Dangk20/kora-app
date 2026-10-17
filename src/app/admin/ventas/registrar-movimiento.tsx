"use client";

// "Registrar movimiento" (solo administrador, permiso `sales:record`): un
// ingreso o egreso del negocio que no pasa por la caja — pago de arriendo,
// aporte de un socio, compra de mercancía… Queda en Movimientos y cuenta en el
// balance; NO toca el efectivo de ningún turno de caja.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCop } from "@/lib/format";
import { registrarMovimiento } from "@/modules/sales/movement-actions";

const campo = "w-full rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-[14.5px] outline-none focus:border-kora-coral";

export function RegistrarMovimiento() {
  const router = useRouter();
  // El botón abre un desplegable (Ingreso / Egreso), como el menú del logo de
  // la caja; elegir uno abre el formulario ya con su tipo.
  const [kind, setKind] = useState<"" | "INGRESO" | "EGRESO">("");
  const abierto = kind !== "";
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrar = () => {
    setKind("");
    setMonto("");
    setMotivo("");
    setError(null);
  };

  async function guardar() {
    if (!kind) return;
    setError(null);
    setGuardando(true);
    const r = await registrarMovimiento({ kind, monto: Number(monto || 0), motivo });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setAviso(`${kind === "INGRESO" ? "Ingreso" : "Egreso"} de ${formatCop(Number(monto))} registrado`);
    setTimeout(() => setAviso(null), 4000);
    cerrar();
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="bg-kora-gradient inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-kora-coral">
          <Plus className="size-4" /> Registrar movimiento <ChevronDown className="size-4 opacity-80" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-[200px]">
          <DropdownMenuItem onSelect={() => setKind("INGRESO")} className="flex items-center gap-2.5">
            <ArrowDownLeft className="size-4 text-[#2f7d4f]" /> Ingreso
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKind("EGRESO")} className="flex items-center gap-2.5">
            <ArrowUpRight className="size-4 text-destructive" /> Egreso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Registrar movimiento"
          onKeyDown={(e) => { if (e.key === "Escape") cerrar(); }}>
          <div className="relative w-full max-w-[440px] rounded-[20px] bg-white p-6 shadow-xl">
            <button type="button" onClick={cerrar} aria-label="Cerrar"
              className="absolute top-4 right-4 rounded-full p-1.5 text-[#9aa0ab] hover:bg-[#f5f3f0] hover:text-kora-black">
              <X className="size-5" />
            </button>
            <h2 className="flex items-center gap-2 text-[19px] font-extrabold text-kora-black">
              {kind === "INGRESO" ? (
                <ArrowDownLeft className="size-5 text-[#2f7d4f]" />
              ) : (
                <ArrowUpRight className="size-5 text-destructive" />
              )}
              Registrar {kind === "INGRESO" ? "ingreso" : "egreso"}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {kind === "INGRESO" ? "Dinero que entra" : "Dinero que sale"} y no pasa por la caja. Cuenta en el balance.
            </p>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">Valor</span>
              <div className="flex items-center rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 focus-within:border-kora-coral">
                <span className="text-[18px] font-bold text-[#9aa0ab]">$</span>
                <input inputMode="numeric" autoComplete="off" autoFocus
                  value={monto ? Number(monto).toLocaleString("es-CO") : ""}
                  onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))}
                  placeholder="0" className="w-full bg-transparent py-3 pl-1.5 text-[18px] font-extrabold outline-none" />
              </div>
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">Concepto</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
                placeholder={kind === "INGRESO" ? "Ej.: aporte de socio" : "Ej.: pago de arriendo, compra de mercancía"} className={campo} />
            </label>

            {error && <p className="mt-3 rounded-[10px] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}

            <button type="button" disabled={!kind || !monto || motivo.trim().length < 3 || guardando} onClick={() => void guardar()}
              className="bg-kora-gradient mt-5 w-full rounded-full px-6 py-3.5 text-[15px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
              {guardando ? "Registrando…" : `Registrar ${kind === "INGRESO" ? "ingreso" : "egreso"}${monto ? ` de ${formatCop(Number(monto))}` : ""}`}
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <div role="status" aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-kora-black px-5 py-3 text-[14px] font-semibold text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
          <CheckCircle2 className="size-5 text-[#5fd08a]" /> {aviso}
        </div>
      )}
    </>
  );
}
