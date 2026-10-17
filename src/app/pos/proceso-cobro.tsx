"use client";

// La animación del cobro en caja (change s09-pos-caja). Es la misma pantalla
// de proceso del checkout (`(tienda)/checkout/pantalla-proceso.tsx`): anillo de
// marca que avanza POR PASO, disco que late y textos que entran. Los pasos
// dicen lo que de verdad hace `registrarVentaPos`, en ese orden.
//
// El anillo no se cierra con el guion: se cierra cuando el servidor responde
// (`listo`), y entonces el disco se vuelve el check verde de la venta hecha.
import { Banknote, Check, FileCheck2, PackageCheck, ReceiptText, Send, UserCheck, type LucideIcon } from "lucide-react";

export type PasoProceso = { icono: LucideIcon; texto: string; detalle: string };

export const pasosCobro = (metodo: string): PasoProceso[] => [
  { icono: Banknote, texto: "Aplicando el cobro", detalle: `Registrando el pago con ${metodo}` },
  { icono: PackageCheck, texto: "Descontando del inventario", detalle: "El mismo stock de la tienda en línea" },
  { icono: ReceiptText, texto: "Generando el comprobante", detalle: "Queda guardado con su número de venta" },
];

/** ⚠️ SIMULADOS: todavía no hay proveedor de facturación conectado. */
export const PASOS_FACTURA: PasoProceso[] = [
  { icono: UserCheck, texto: "Validando los datos del cliente", detalle: "Documento, nombre y correo" },
  { icono: Send, texto: "Enviando a la DIAN", detalle: "Esperando la validación" },
  { icono: FileCheck2, texto: "Factura aprobada", detalle: "Se envía al correo del cliente" },
];

const RADIO = 58;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export function ProcesoCobro({ pasos, paso, listo }: { pasos: PasoProceso[]; paso: number; listo: boolean }) {
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const Icono = listo ? Check : actual.icono;
  const avance = listo ? 1 : (paso + 1) / (pasos.length + 0.35);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Las manchas se posicionan contra la TARJETA del modal (que recorta con
          sus bordes redondeados), no contra este bloque: recortadas aquí se
          veía un rectángulo de color dentro del modal. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="pos-aura absolute -top-10 left-1/2 size-[300px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,0.13),transparent_68%)] blur-2xl" />
        <div className="pos-aura pos-aura-lenta absolute -bottom-16 left-1/2 size-[280px] -translate-x-[62%] rounded-full bg-[radial-gradient(circle,rgba(122,61,184,0.12),transparent_68%)] blur-2xl" />
      </div>

      <div role="status" aria-live="polite" aria-busy={!listo} className="relative flex flex-col items-center">
        <div className="relative flex size-[140px] items-center justify-center">
          <svg viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
            <defs>
              <linearGradient id="posAnillo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={listo ? "#3c8a5c" : "#FF6A00"} />
                <stop offset="100%" stopColor={listo ? "#2f7d4f" : "#7A3DB8"} />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={RADIO} fill="none" stroke="#F1E7DC" strokeWidth="6" />
            <circle
              cx="70" cy="70" r={RADIO} fill="none" stroke="url(#posAnillo)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - avance)}
              style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </svg>
          <span
            className={`flex size-[86px] items-center justify-center rounded-full transition-colors duration-500 ${
              listo ? "bg-[#2f7d4f] shadow-[0_12px_30px_-10px_rgba(47,125,79,0.6)]" : "bg-kora-gradient pos-latido shadow-[0_12px_30px_-10px_rgba(255,106,0,0.55)]"
            }`}
          >
            <Icono key={listo ? "listo" : paso} className="pos-entra size-9 text-white" strokeWidth={listo ? 2.6 : 1.9} />
          </span>
        </div>

        {!listo && (
          <>
            <div className="mt-7 min-h-[60px]">
              <p key={`t-${paso}`} className="pos-entra text-[19px] leading-snug font-extrabold text-kora-black">{actual.texto}…</p>
              <p key={`d-${paso}`} className="pos-entra pos-entra-tarde mt-1.5 text-[14px] text-muted-foreground">{actual.detalle}</p>
            </div>
            <div className="mt-5 flex gap-2">
              {pasos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i < paso ? "bg-kora-orange/45 w-2.5" : i === paso ? "bg-kora-gradient w-8" : "w-2.5 bg-[#EBE2D8]"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mismas animaciones que la pantalla del checkout, con su propio
          prefijo; `prefers-reduced-motion` las apaga. */}
      <style>{`
        @keyframes posEntra { from { opacity: 0; transform: translateY(9px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes posLatido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.055); } }
        @keyframes posAura { 0%, 100% { transform: translate(-50%, 0) scale(1); opacity: .85; } 50% { transform: translate(-50%, -14px) scale(1.09); opacity: 1; } }
        .pos-entra { animation: posEntra 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .pos-entra-tarde { animation-delay: 90ms; }
        .pos-latido { animation: posLatido 2.4s ease-in-out infinite; }
        .pos-aura { animation: posAura 7s ease-in-out infinite; }
        .pos-aura-lenta { animation-duration: 9s; animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) { .pos-entra, .pos-latido, .pos-aura { animation: none !important; } }
      `}</style>
    </div>
  );
}
