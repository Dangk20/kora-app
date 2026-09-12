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
import { SendDialog } from "./send-dialog";
import {
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
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
  const [envio, setEnvio] = useState(false);

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
        <button className={btn} disabled={pendiente} onClick={() => setEnvio(true)}>
          <Send className="size-3.5" /> Enviar
        </button>
      )}

      <SendDialog
        campaignId={id}
        recipients={recipients}
        open={envio}
        onClose={() => setEnvio(false)}
        onSent={() => router.refresh()}
      />

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
