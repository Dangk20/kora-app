import { Gauge } from "lucide-react";
import type { EmailUsage } from "@/modules/email/usage";

function Barra({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  const pct = Math.min(100, Math.round((usado / limite) * 100));
  // El color cambia por lo que QUEDA, no por estética: a partir del 80 % una
  // campaña mediana ya no cabe hoy.
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-kora-coral" : "bg-kora-black";
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-kora-black tabular-nums">
          {usado.toLocaleString("es-CO")}
          <span className="font-normal text-muted-foreground"> / {limite.toLocaleString("es-CO")}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efeae4]">
        <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Consumo del plan del proveedor, hoy y este mes.
 *
 * Es NUESTRA cuenta, no la del proveedor —que no la expone—. Exacta mientras
 * todo correo pase por KORA. Incluye los transaccionales: el cupo es uno solo.
 */
export function ConsumoDelPlan({ usage }: { usage: EmailUsage }) {
  return (
    <div className="mb-5 rounded-[12px] border border-[#eee9e2] bg-white px-5 py-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-kora-black">
        <Gauge className="size-4 text-kora-coral" />
        Consumo del plan de correo
        <span className="ml-auto text-[11.5px] font-normal text-muted-foreground">
          Incluye los correos de pedidos · corte a medianoche UTC
        </span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
        <Barra label="Hoy" usado={usage.today} limite={usage.limits.daily} />
        <Barra label="Este mes" usado={usage.month} limite={usage.limits.monthly} />
      </div>
    </div>
  );
}
