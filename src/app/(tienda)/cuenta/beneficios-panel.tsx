// "Mis beneficios" del comprador (change beneficios). Solo lectura: los
// descuentos y regalos se canjean en la caja de la tienda física.
import { Gift } from "lucide-react";
import type { BeneficioCliente } from "@/modules/benefits/benefits";
import { getMessages } from "@/modules/i18n/server";

const ESTADO = {
  VIGENTE: "bg-[#e8f6ec] text-[#1f7a3d]",
  USADO: "bg-[#f0ece6] text-[#6b6f78]",
  VENCIDO: "bg-[#f4f2ef] text-[#a3a7af]",
} as const;

export async function BeneficiosPanel({ beneficios }: { beneficios: BeneficioCliente[] }) {
  if (beneficios.length === 0) return null;
  const t = (await getMessages()).cuenta.beneficios;
  const fecha = (d: Date) => new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
  const etiqueta = { VIGENTE: t.vigente, USADO: t.usado, VENCIDO: t.vencido };

  return (
    <div className="mt-6">
      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-extrabold text-kora-black">
        <Gift className="size-4 text-[#FF5A1F]" /> {t.titulo}
      </h3>
      <ul className="space-y-2">
        {beneficios.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-[#eee9e2] bg-white px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-kora-black">{b.title}</div>
              <div className="text-[12px] text-muted-foreground">
                {b.estado === "USADO"
                  ? t.usadoEn(b.usedOrderNumber)
                  : b.estado === "VENCIDO"
                    ? t.vencio(fecha(b.expiresAt))
                    : t.vence(fecha(b.expiresAt))}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${ESTADO[b.estado]}`}>
              {etiqueta[b.estado]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t.comoUsar}</p>
    </div>
  );
}
