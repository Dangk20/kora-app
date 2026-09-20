"use client";

// Paso 3: revisar y decidir. El correo entero, a quién va y cuántos son, una
// prueba a tu propio correo, y las tres salidas: enviar ahora, programar o
// dejarlo en borrador. Aquí ya no se edita nada — para eso están los pasos
// anteriores, a un clic.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scheduleCampaign, sendTestEmail } from "@/modules/campaigns/actions";
import type { Segment } from "@/modules/campaigns/types";
import { SendDialog } from "../send-dialog";
import { Previa } from "./previa";
import { Seccion, describirSegmento, inputCls, labelCls } from "./ui";

/** `2026-10-03T09:00` en Bogotá (UTC−5, sin horario de verano) → instante real. */
function desdeBogota(local: string): Date {
  return new Date(`${local}:00-05:00`);
}

export function PasoRevisar({
  campaignId,
  datos,
  segment,
  categorias,
  conteo,
  html,
}: {
  campaignId: string;
  datos: { name: string; subject: string; preheader: string };
  segment: Segment;
  categorias: { id: string; name: string }[];
  conteo: number | null;
  html: string;
}) {
  const router = useRouter();
  const [prueba, setPrueba] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviar, setEnviar] = useState(false);
  const [programar, setProgramar] = useState(false);
  const [cuando, setCuando] = useState("");
  const [errorProg, setErrorProg] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[460px] shrink-0 flex-col overflow-y-auto border-r border-[#eee9e2] bg-white px-5 py-5">
        <Seccion titulo="Lo que sale">
          <dl className="space-y-2 text-[13.5px]">
            <div><dt className="text-[11.5px] text-[#9aa0ab]">Asunto</dt><dd className="font-semibold text-kora-black">{datos.subject}</dd></div>
            {datos.preheader && <div><dt className="text-[11.5px] text-[#9aa0ab]">Texto de vista previa</dt><dd className="text-kora-black">{datos.preheader}</dd></div>}
          </dl>
        </Seccion>

        <Seccion titulo="A quién">
          <div className="flex items-start gap-3 rounded-[12px] border border-[#ffd9c7] bg-[#FFF4EF] px-4 py-3.5">
            <Users className="mt-0.5 size-5 shrink-0 text-kora-coral" />
            <div>
              <p className="text-[15px] font-bold text-kora-black">
                {conteo === null ? "Calculando…" : `${conteo} destinatario${conteo === 1 ? "" : "s"}`}
              </p>
              <p className="text-[12.5px] text-muted-foreground">{describirSegmento(segment, categorias)}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Es un estimado: se recalcula en el momento del envío con quien se haya suscrito o dado de baja.
              </p>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Envíate una prueba">
          <div className="flex gap-2">
            <input value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="tu@correo.com" className={inputCls} />
            <Button type="button" variant="outline" size="sm" disabled={!prueba.includes("@")}
              onClick={async () => {
                const r = await sendTestEmail(campaignId, prueba);
                setAviso(r.ok ? (r.message ?? "Enviado.") : r.error);
              }}>
              <Send className="size-3.5" /> Probar
            </Button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">No cuenta como envío de campaña ni afecta sus métricas.</p>
          {aviso && <p className="mt-1.5 text-[12px] text-kora-black">{aviso}</p>}
        </Seccion>

        <Seccion titulo="Y ahora">
          <div className="space-y-2">
            <Button type="button" variant="brand" className="w-full" onClick={() => setEnviar(true)}>
              <Send className="size-4" /> Enviar ahora
            </Button>
            {!programar ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => setProgramar(true)}>
                <CalendarClock className="size-4" /> Programar el envío
              </Button>
            ) : (
              <div className="rounded-[12px] border border-[#e2ddd6] p-3">
                <label className={labelCls}>Cuándo <span className="font-normal text-[#9aa0ab]">(hora de Colombia)</span></label>
                <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} className={inputCls} />
                {errorProg && <p className="mt-1 text-[12px] text-destructive">{errorProg}</p>}
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="brand" size="sm" disabled={!cuando || pendiente}
                    onClick={() => startTransition(async () => {
                      const r = await scheduleCampaign(campaignId, desdeBogota(cuando));
                      if (!r.ok) setErrorProg(r.error);
                      else router.push(`/admin/campanas/${campaignId}`);
                    })}>
                    {pendiente ? "Programando…" : "Programar"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setProgramar(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            <p className="pt-1 text-center text-[11.5px] text-muted-foreground">
              Ya está guardada como borrador: puedes cerrar y volver después.
            </p>
          </div>
        </Seccion>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f3efe9] px-6 py-4 [background-image:radial-gradient(#dcd5cb_1px,transparent_1px)] [background-size:18px_18px]">
        <p className="mb-1 text-[12.5px] text-muted-foreground">Así llega. Mira también el modo oscuro: Gmail en el móvil lo aplica solo.</p>
        <Previa html={html} />
      </div>

      <SendDialog
        campaignId={campaignId}
        recipients={conteo ?? 0}
        open={enviar}
        onClose={() => setEnviar(false)}
        onSent={() => router.push(`/admin/campanas/${campaignId}`)}
      />
    </div>
  );
}
