"use client";

// Acciones por fila del listado de campañas.
//
// Qué se ofrece depende del ESTADO, y no solo del permiso: una campaña que ya
// está saliendo no se puede cancelar —los correos van en camino y el botón
// mentiría— y una enviada no se edita ni se borra, porque es el registro de lo
// que recibió cada quien.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Send, Trash2, XCircle } from "lucide-react";
import type { CampaignStatus } from "@/generated/prisma/enums";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  sendNow,
} from "@/modules/campaigns/actions";

const btn =
  "inline-flex items-center gap-1 rounded-[8px] border border-[#e2ddd6] px-2.5 py-1.5 text-[12px] font-semibold text-kora-black hover:border-[#ddd6cd] disabled:opacity-50";

export function RowActions({
  id,
  status,
  editHref,
  puedeCrear,
  puedeEnviar,
  recipients,
}: {
  id: string;
  status: CampaignStatus;
  editHref: string;
  puedeCrear: boolean;
  puedeEnviar: boolean;
  /** Para decirlo en el modal: es lo último que separa segmentar de escribirle a toda la base. */
  recipients: number;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // El modal de envío tiene dos pasos posibles: confirmar, y —si la audiencia
  // no cabe en el cupo del día— confirmar otra vez sabiendo cuántos salen hoy.
  const [envio, setEnvio] = useState<null | { paso: "confirmar" } | { paso: "parcial"; today: number; later: number }>(null);

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No se pudo completar la acción.");
      else {
        setError(null);
        router.refresh();
      }
    });

  const editable = status === "DRAFT" || status === "SCHEDULED";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {error && <span className="mr-1 text-[11.5px] text-destructive">{error}</span>}

      {editable && puedeCrear && (
        <Link href={editHref} className={btn}>
          <Pencil className="size-3.5" /> Editar
        </Link>
      )}

      {status === "DRAFT" && puedeEnviar && (
        <button className={btn} disabled={pendiente} onClick={() => setEnvio({ paso: "confirmar" })}>
          <Send className="size-3.5" /> Enviar
        </button>
      )}

      <Dialog open={envio !== null} onOpenChange={(o) => !o && setEnvio(null)}>
        <DialogContent
          overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[440px] motion-reduce:duration-0"
        >
          <div className="px-6 pt-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[17px] font-bold text-kora-black">
                {envio?.paso === "parcial" ? "No cabe todo en el cupo de hoy" : "¿Enviar esta campaña ahora?"}
              </DialogTitle>
              <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
                {envio?.paso === "parcial" ? (
                  <>
                    Hoy caben{" "}
                    <span className="font-semibold text-kora-black">{envio.today}</span> envíos en el plan
                    del proveedor. Saldrían {envio.today} ahora y{" "}
                    <span className="font-semibold text-kora-black">{envio.later}</span> en los días
                    siguientes, solos, a medida que haya cupo.
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
          </div>

          {/* Cancelar dominante, como en el resto del sistema: es lo último
              que separa segmentar de escribirle a toda la base. */}
          <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
            <button
              type="button"
              onClick={() => setEnvio(null)}
              className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                const parcial = envio?.paso === "parcial";
                correr(async () => {
                  const r = await sendNow(id, { acceptPartial: parcial });
                  if (!r.ok && r.partial) {
                    setEnvio({ paso: "parcial", today: r.partial.today, later: r.partial.later });
                    return { ok: true };
                  }
                  setEnvio(null);
                  return r;
                });
              }}
              className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-kora-coral transition-colors hover:bg-[#FFE9DD] disabled:opacity-60"
            >
              {pendiente ? "Enviando…" : envio?.paso === "parcial" ? "Enviar de todas formas" : "Sí, enviar ahora"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {status === "SCHEDULED" && puedeEnviar && (
        <button className={btn} disabled={pendiente} onClick={() => correr(() => cancelCampaign(id))}>
          <XCircle className="size-3.5" /> Cancelar
        </button>
      )}

      {puedeCrear && (
        <button className={btn} disabled={pendiente} onClick={() => correr(() => duplicateCampaign(id))}>
          <Copy className="size-3.5" /> Duplicar
        </button>
      )}

      {status === "DRAFT" && puedeCrear && (
        <button
          className={btn}
          disabled={pendiente}
          onClick={() => {
            if (!confirm("¿Eliminar este borrador?")) return;
            correr(() => deleteCampaign(id));
          }}
        >
          <Trash2 className="size-3.5" /> Eliminar
        </button>
      )}
    </div>
  );
}
