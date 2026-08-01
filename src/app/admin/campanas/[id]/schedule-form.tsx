"use client";

// Programar el envío de un borrador.
//
// La hora se interpreta en la zona del negocio (América/Bogotá) porque es la
// que el operador tiene en la cabeza: "el martes a las 9" significa las 9 de
// Bogotá, no las del servidor.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scheduleCampaign } from "@/modules/campaigns/actions";

/** `2026-10-03T09:00` en Bogotá (UTC−5, sin horario de verano) → instante real. */
function desdeBogota(local: string): Date {
  return new Date(`${local}:00-05:00`);
}

export function ScheduleForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cuando, setCuando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (!abierto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <CalendarClock className="size-4" /> Programar envío
      </Button>
    );
  }

  return (
    <div className="rounded-[12px] border border-[#e2ddd6] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
          className="rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2 text-[13.5px] outline-none focus:border-kora-coral"
        />
        <Button
          variant="brand"
          size="sm"
          disabled={!cuando || pendiente}
          onClick={() =>
            startTransition(async () => {
              const r = await scheduleCampaign(campaignId, desdeBogota(cuando));
              if (!r.ok) setError(r.error);
              else {
                setError(null);
                setAbierto(false);
                router.refresh();
              }
            })
          }
        >
          Programar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        Hora de Colombia. Al dispararse, la audiencia se recalcula: entra quien se haya suscrito y
        sale quien se haya dado de baja.
      </p>
      {error && <p className="mt-1 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
