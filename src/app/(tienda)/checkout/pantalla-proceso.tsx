"use client";

// La pantalla que se ve mientras se crea el pedido.
//
// No es un adorno para tapar la espera: es la única ventana que el comprador
// tiene a un proceso que ocurre entero en el servidor. Acaba de dar el clic más
// importante de la compra y, sin esto, ve un botón deshabilitado y decide por
// su cuenta si funcionó — y a veces vuelve a pulsar.
//
// Los pasos DICEN LO QUE PASA, no lo que suena bien. Cada uno corresponde a
// trabajo real de `createOrder`: se guardan las líneas con su precio resuelto en
// servidor, se consume el cupón y el cashback dentro de la transacción, y se
// arma el mensaje de WhatsApp. Inventar pasos convertiría esto en un teatro, y
// un teatro se nota el día que tarda de verdad.
//
// El anillo avanza POR PASO, no por porcentaje. Nadie sabe cuánto va a tardar
// el servidor: una barra que dice "73 %" se lo está inventando, y cuando se
// queda parada en ese 73 % el comprador entiende, con razón, que algo se rompió.

import { useEffect, useState } from "react";
import { ClipboardCheck, MessageCircle, ShieldCheck, Wallet } from "lucide-react";

const PASOS = [
  { texto: "Guardando tu pedido", detalle: "Estamos registrando tus productos", Icono: ClipboardCheck },
  { texto: "Confirmando disponibilidad", detalle: "Revisamos precios y existencias", Icono: ShieldCheck },
  { texto: "Aplicando tus beneficios", detalle: "Descuentos y Kora Cashback", Icono: Wallet },
  { texto: "Casi listo", detalle: "Te conectamos con un asesor por WhatsApp", Icono: MessageCircle },
] as const;

/**
 * Cada paso se enseña un momento antes de pasar al siguiente.
 *
 * La creación del pedido suele tardar menos que esto, y es a propósito: la
 * pantalla no espera a que termine para avanzar, pero tampoco desaparece antes
 * de que se pueda leer. Un mensaje que parpadea es peor que ninguno.
 */
const MS_POR_PASO = 1100;

const RADIO = 58;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export function PantallaProceso({ onListo }: { onListo?: () => void }) {
  const [paso, setPaso] = useState(0);

  // Subir arriba al entrar. El comprador pulsa el botón desde el FINAL de un
  // formulario largo, y la posición del scroll sobrevive al cambio de pantalla:
  // sin esto, el anillo nace tapado por el encabezado y lo que se ve es media
  // circunferencia flotando. Se probó en el navegador, no es precaución teórica.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (paso >= PASOS.length - 1) {
      // Último paso: se queda un momento y avisa de que ya se puede pasar.
      //
      // Sin esto la pantalla dura lo que tarda el servidor —unos 300 ms— y
      // parpadea: el comprador ve un destello y no entiende qué pasó. El aviso
      // NO acelera nada; solo dice "ya se leyó", y quien decide seguir es el
      // checkout, cuando además tenga la respuesta de verdad.
      const t = setTimeout(() => onListo?.(), MS_POR_PASO);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPaso((p) => p + 1), MS_POR_PASO);
    return () => clearTimeout(t);
  }, [paso, onListo]);

  const { texto, detalle, Icono } = PASOS[paso];
  // El último paso no llega al 100 %: el círculo se cierra cuando el servidor
  // responde de verdad, no cuando se acaba el guion.
  const avance = (paso + 1) / (PASOS.length + 0.35);

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6 py-16">
      {/* Fondo: dos manchas de color muy suaves, respirando. Es lo que hace que
          la espera se sienta viva sin distraer del texto. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="kora-aura absolute top-[12%] left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,0.13),transparent_68%)] blur-2xl" />
        <div className="kora-aura kora-aura-lenta absolute bottom-[8%] left-1/2 size-[380px] -translate-x-[62%] rounded-full bg-[radial-gradient(circle,rgba(122,61,184,0.12),transparent_68%)] blur-2xl" />
      </div>

      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className="flex w-full max-w-[420px] flex-col items-center text-center"
      >
        <div className="relative flex size-[140px] items-center justify-center">
          <svg viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
            <defs>
              <linearGradient id="koraAnillo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF6A00" />
                <stop offset="100%" stopColor="#7A3DB8" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={RADIO} fill="none" stroke="#F1E7DC" strokeWidth="6" />
            <circle
              cx="70"
              cy="70"
              r={RADIO}
              fill="none"
              stroke="url(#koraAnillo)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - avance)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </svg>

          {/* El disco central late despacio: da señal de vida cuando el anillo
              está quieto porque el servidor todavía no ha contestado. */}
          <span className="bg-kora-gradient kora-latido flex size-[86px] items-center justify-center rounded-full shadow-[0_12px_30px_-10px_rgba(255,106,0,0.55)]">
            {/* `key` fuerza el remontaje: así el icono entra con su animación
                en cada paso en vez de cambiar de golpe. */}
            <Icono key={paso} className="kora-entra size-9 text-white" strokeWidth={1.9} />
          </span>
        </div>

        <div className="mt-9 min-h-[68px]">
          <p key={`t-${paso}`} className="kora-entra text-[19px] leading-snug font-extrabold text-kora-black">
            {texto}
          </p>
          <p key={`d-${paso}`} className="kora-entra kora-entra-tarde mt-1.5 text-[14px] text-muted-foreground">
            {detalle}
          </p>
        </div>

        <div className="mt-7 flex gap-2">
          {PASOS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < paso
                  ? "bg-kora-orange/45 w-2.5"
                  : i === paso
                    ? "bg-kora-gradient w-8"
                    : "w-2.5 bg-[#EBE2D8]"
              }`}
            />
          ))}
        </div>

        <p className="mt-9 text-[12.5px] text-muted-foreground">
          No cierres esta ventana. Tardamos unos segundos.
        </p>
      </div>

      {/* Las animaciones viven aquí y no en globals.css porque solo las usa esta
          pantalla. `prefers-reduced-motion` las apaga todas: para quien marcó
          esa preferencia, el movimiento no es un detalle bonito — puede ser
          mareo o migraña. La pantalla sigue funcionando exactamente igual. */}
      <style>{`
        @keyframes koraEntra {
          from { opacity: 0; transform: translateY(9px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes koraLatido {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.055); }
        }
        @keyframes koraAura {
          0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.85; }
          50%      { transform: translate(-50%, -14px) scale(1.09); opacity: 1; }
        }
        .kora-entra { animation: koraEntra 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .kora-entra-tarde { animation-delay: 90ms; }
        .kora-latido { animation: koraLatido 2.4s ease-in-out infinite; }
        .kora-aura { animation: koraAura 7s ease-in-out infinite; }
        .kora-aura-lenta { animation-duration: 9s; animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) {
          .kora-entra, .kora-latido, .kora-aura { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
