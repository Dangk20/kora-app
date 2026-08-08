// Candado de Email marketing, en la puerta del módulo.
//
// Va en el layout y no en cada página para que lo herede todo lo que cuelga de
// `/admin/campanas` —la lista, el detalle, la previa— y no haya que acordarse
// de ponerlo en la siguiente pantalla que se añada.
//
// **Se enseña cerrado, no se esconde.** Ocultarlo dejaría al cliente
// preguntando dónde está lo que compró (§6 de la cotización); enseñarlo con lo
// que falta convierte el candado en el recordatorio de los dos insumos que él
// tiene que traer.
//
// Esto NO es la seguridad del módulo: es su cartel. Lo que impide de verdad
// que salga un correo son las guardas de `modules/campaigns/lock.ts` en cada
// acción y en el worker.
import { Lock } from "lucide-react";
import { MARKETING_LOCK_REASON, marketingEnabled } from "@/modules/campaigns/lock";

// La variable se lee en cada petición, no al compilar: la misma imagen de Docker
// corre en pruebas y en producción, y el candado puede estar abierto en una y
// cerrado en la otra.
export const dynamic = "force-dynamic";

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  if (marketingEnabled()) return <>{children}</>;

  return (
    <div className="mx-auto max-w-[620px] py-16">
      <div className="rounded-2xl border border-[#e8e2da] bg-white p-9 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f4f1ec]">
          <Lock className="size-6 text-[#8a8f98]" strokeWidth={1.8} />
        </span>

        <h1 className="mt-5 text-xl font-bold text-kora-black">Email marketing no está abierto</h1>

        <p className="mt-3 text-sm leading-relaxed text-[#6b7078]">{MARKETING_LOCK_REASON}</p>

        <p className="mt-5 rounded-xl bg-[#faf8f5] px-4 py-3 text-[13px] leading-relaxed text-[#8a8f98]">
          El módulo está construido y no se ha perdido nada: se abre en cuanto el
          dominio pueda enviar. Los comprobantes de pedido no dependen de esto.
        </p>
      </div>
    </div>
  );
}
