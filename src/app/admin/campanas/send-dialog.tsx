"use client";

// El modal de envío: confirmar, y —si la audiencia no cabe en el cupo del
// día— confirmar otra vez sabiendo cuántos salen hoy. Lo usan el listado y el
// último paso del constructor: UNA definición.

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendNow } from "@/modules/campaigns/actions";

export type EnvioPaso = { paso: "confirmar" } | { paso: "parcial"; today: number; later: number };

export function SendDialog({
  campaignId,
  recipients,
  open,
  onClose,
  onSent,
}: {
  campaignId: string;
  recipients: number;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [paso, setPaso] = useState<EnvioPaso>({ paso: "confirmar" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const cerrar = () => {
    setPaso({ paso: "confirmar" });
    setError(null);
    onClose();
  };

  const enviar = () => {
    const parcial = paso.paso === "parcial";
    startTransition(async () => {
      const r = await sendNow(campaignId, { acceptPartial: parcial });
      if (!r.ok && r.partial) {
        setPaso({ paso: "parcial", today: r.partial.today, later: r.partial.later });
        return;
      }
      if (!r.ok) {
        setError(r.error);
        return;
      }
      cerrar();
      onSent();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent
        overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[440px] motion-reduce:duration-0"
      >
        <div className="px-6 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-[17px] font-bold text-kora-black">
              {paso.paso === "parcial" ? "No cabe todo en el cupo de hoy" : "¿Enviar esta campaña ahora?"}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
              {paso.paso === "parcial" ? (
                <>
                  Hoy caben <span className="font-semibold text-kora-black">{paso.today}</span> envíos en el
                  plan del proveedor. Saldrían {paso.today} ahora y{" "}
                  <span className="font-semibold text-kora-black">{paso.later}</span> en los días siguientes,
                  solos, a medida que haya cupo.
                </>
              ) : (
                <>
                  Saldrá a{" "}
                  <span className="font-semibold text-kora-black">
                    {recipients} destinatario{recipients === 1 ? "" : "s"}
                  </span>{" "}
                  del segmento. Una campaña enviada no se puede detener ni editar.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="mt-3 rounded-[10px] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
              {error}
            </p>
          )}
        </div>

        {/* Cancelar dominante, como en el resto del sistema: es lo último
            que separa segmentar de escribirle a toda la base. */}
        <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
          <button
            type="button"
            onClick={cerrar}
            className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={enviar}
            className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-kora-coral transition-colors hover:bg-[#FFE9DD] disabled:opacity-60"
          >
            {pendiente ? "Enviando…" : paso.paso === "parcial" ? "Enviar de todas formas" : "Sí, enviar ahora"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
