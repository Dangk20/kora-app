"use client";

// "Se agregó al carrito": la confirmación que faltaba.
//
// Hasta ahora, agregar desde la ficha solo cambiaba el texto del propio botón
// —que está justo bajo el cursor y a menudo fuera de la vista tras el scroll—
// y desde cualquier otro sitio no pasaba NADA visible. El comprador pulsaba,
// no veía nada y volvía a pulsar: dos unidades en el carrito y una sorpresa
// en la conversación de WhatsApp.
//
// Lo dispara el propio `CartProvider`, no cada botón: así ningún camino nuevo
// para agregar puede olvidarse de confirmar.
import { ShoppingCart, Check } from "lucide-react";
import { useEffect, useState } from "react";

export type AvisoAgregado = { id: number; nombre?: string };

export function AvisoDeAgregado({
  aviso,
  onVerCarrito,
}: {
  aviso: AvisoAgregado | null;
  onVerCarrito: () => void;
}) {
  // El último mensaje se conserva para que el aviso pueda SALIR con su
  // animación en vez de desaparecer de golpe cuando `aviso` vuelve a null.
  const [ultimo, setUltimo] = useState<AvisoAgregado | null>(null);
  useEffect(() => {
    if (aviso) setUltimo(aviso);
  }, [aviso]);

  const visible = aviso !== null;
  if (!ultimo) return null;

  return (
    <div
      // `aria-live` para que un lector de pantalla anuncie el cambio: sin
      // esto la confirmación existiría solo para quien puede verla.
      role="status"
      aria-live="polite"
      className={[
        "fixed right-4 left-4 z-[60] sm:left-auto sm:w-[340px]",
        // En móvil se queda por encima de la barra inferior; en escritorio,
        // en la esquina, lejos del recorrido del cursor.
        "bottom-[calc(env(safe-area-inset-bottom)+84px)] sm:right-6 sm:bottom-6",
        "flex items-center gap-3 rounded-2xl bg-kora-black px-4 py-3.5",
        "shadow-[0_20px_44px_-14px_rgba(22,24,29,0.55)]",
        "transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        "motion-reduce:transition-none",
      ].join(" ")}
    >
      <span className="bg-kora-gradient flex size-9 shrink-0 items-center justify-center rounded-full">
        <Check className="size-[18px] text-white" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-white">Agregado al carrito</p>
        {ultimo.nombre && (
          <p className="truncate text-[12px] text-[#A0A4AD]">{ultimo.nombre}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onVerCarrito}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/20"
      >
        <ShoppingCart className="size-4" aria-hidden />
        Ver
      </button>
    </div>
  );
}
