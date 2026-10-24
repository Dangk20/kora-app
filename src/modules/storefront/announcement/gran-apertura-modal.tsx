"use client";

// Modal de la gran apertura: un calendario con el 7 de noviembre marcado a
// mano, en el bloque de color de la marca. Aparece una vez por visitante y
// caduca solo después del evento (ver config.ts).
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/modules/i18n/provider";
import { ANUNCIO_CLAVE, MAPS_URL, anuncioVigente } from "./config";
import { COOKIE_CONSENTIMIENTO } from "@/modules/measurement/attribution";

function leerVisto(): boolean {
  try {
    return localStorage.getItem(ANUNCIO_CLAVE) !== null;
  } catch {
    return true; // sin almacenamiento (modo privado estricto): mejor no insistir en cada página
  }
}
function marcarVisto() {
  try {
    localStorage.setItem(ANUNCIO_CLAVE, new Date().toISOString());
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** `esperaConsentimiento`: hay aviso de cookies en esta tienda; el modal sale solo después de que el visitante lo responda. */
export function GranAperturaModal({ esperaConsentimiento }: { esperaConsentimiento: boolean }) {
  const t = useMessages().anuncio;
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    // Un respiro para no tapar la tienda mientras carga.
    if (!anuncioVigente(Date.now(), leerVisto())) return;
    let mostrar: number | undefined;
    const programar = () => (mostrar = window.setTimeout(() => setAbierto(true), 1200));
    if (!esperaConsentimiento || document.cookie.includes(`${COOKIE_CONSENTIMIENTO}=`)) {
      programar();
      return () => window.clearTimeout(mostrar);
    }
    // El aviso de cookies está en pantalla: esperar a que lo respondan.
    const vigia = window.setInterval(() => {
      if (document.cookie.includes(`${COOKIE_CONSENTIMIENTO}=`)) {
        window.clearInterval(vigia);
        programar();
      }
    }, 700);
    return () => {
      window.clearInterval(vigia);
      window.clearTimeout(mostrar);
    };
  }, [esperaConsentimiento]);

  function cambiar(v: boolean) {
    setAbierto(v);
    if (!v) marcarVisto();
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="overflow-hidden rounded-3xl border-0 bg-[#F5F3F0] p-0 sm:max-w-md">
        {/* El calendario */}
        <div className="relative h-[230px] overflow-hidden bg-white sm:h-[300px]" aria-hidden="true">
          <div className="absolute inset-[-40px] rotate-[-6deg]">
            <div className="grid h-full grid-cols-3 grid-rows-3">
              {["", "", "", "6", "", "8", "", "", ""].map((n, i) => (
                <div key={i} className="relative border border-neutral-900/80">
                  {n && <span className="absolute right-3 bottom-2 font-sans text-4xl font-medium text-neutral-900">{n}</span>}
                </div>
              ))}
            </div>
            {/* el día: bloque de marca */}
            <div className="bg-kora-gradient absolute top-1/3 left-1/3 flex h-1/3 w-1/3 flex-col justify-between p-3 text-white">
              <span className="text-[11px] font-medium tracking-wide">{t.mes}</span>
              <span className="text-[19px] leading-[1.05] font-extrabold tracking-tight uppercase">{t.titulo}</span>
              <span className="absolute top-1.5 right-3 text-3xl font-semibold">7</span>
              <svg viewBox="0 0 120 70" className="absolute -top-3 -right-5 w-[96px] text-neutral-900">
                <path
                  d="M18 40 C 10 18, 60 4, 96 14 C 122 22, 118 52, 82 60 C 52 66, 20 58, 22 40 C 24 26, 52 16, 80 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
        {/* El mensaje */}
        <div className="px-6 pt-5 pb-6 text-center">
          <p className="text-kora-gradient text-xs font-bold tracking-[0.25em] uppercase">{t.sobretitulo}</p>
          <DialogTitle className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-900">{t.titulo} · 7 {t.mes}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-neutral-600">{t.cuerpo}</DialogDescription>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-neutral-900">
            <MapPin className="size-4 text-[#F2357E]" aria-hidden="true" />
            {t.direccion}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="brand" size="lg" asChild>
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" onClick={() => cambiar(false)}>
                {t.comoLlegar}
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => cambiar(false)}>
              {t.ahoraNo}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
