"use client";

import { CalendarClock, MapPin, ShoppingBag } from "lucide-react";

// La ruleta dibujada y la celebración del premio, con los colores de KORA
// (naranja, rosado, morado, negro y crema; aro en el degradé de la marca).
//
// Cuando frena, la tajada ganadora se ilumina bajo la flecha y las demás se
// apagan; después sale la celebración (referencia de Temu que pasó Daniel,
// 17 oct 2026): estrellas y confeti, "¡Ganaste!" y una etiqueta grande con el
// premio.

export type Tajada = { key: string; grande: string; chico: string; frase: string; kind: string; super: boolean };

export const TAM = 320;
const C = TAM / 2;
const R = 136;

/** Fondo y tinta de las tajadas normales, en orden. El súper premio va aparte. */
const PALETA = [
  { fondo: "#f9f3ee", grande: "#121212", chico: "#ff5a1f" },
  { fondo: "#f2357e", grande: "#ffffff", chico: "#ffe3ee" },
  { fondo: "#fff8f2", grande: "#121212", chico: "#7a3db8" },
  { fondo: "#7a3db8", grande: "#ffffff", chico: "#eadcff" },
  { fondo: "#f9f3ee", grande: "#121212", chico: "#f2357e" },
];

function punto(angulo: number, radio: number) {
  // 0° = arriba, en el sentido del reloj. Redondeado: el servidor y el
  // navegador no dan los mismos decimales y React lo marca al hidratar.
  const rad = ((angulo - 90) * Math.PI) / 180;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { x: r2(C + radio * Math.cos(rad)), y: r2(C + radio * Math.sin(rad)) };
}

function tajadaPath(i: number, seg: number, radio = R) {
  const ini = punto(i * seg, radio);
  const fin = punto((i + 1) * seg, radio);
  return `M${C} ${C} L${ini.x} ${ini.y} A${radio} ${radio} 0 0 1 ${fin.x} ${fin.y} Z`;
}

export function Rueda({
  premios,
  rotacion,
  girando,
  duracionMs,
  ganador,
}: {
  premios: Tajada[];
  rotacion: number;
  girando: boolean;
  duracionMs: number;
  /** La tajada que cayó: se ilumina y las demás se apagan. */
  ganador: string | null;
}) {
  const seg = 360 / premios.length;
  let n = 0;
  const colores = premios.map((p) => (p.super ? null : PALETA[n++ % PALETA.length]));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[330px]">
      <style>{`
        @keyframes ruleta-foco{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes ruleta-luz{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes ruleta-halo{0%{transform:scale(.96);opacity:.0}40%{opacity:.9}100%{transform:scale(1.08);opacity:0}}
      `}</style>

      {/* Halo de marca que late cuando cae el premio */}
      {ganador && !girando && (
        <div
          className="absolute inset-[-14px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,106,0,.55), rgba(242,53,126,.35) 55%, transparent 70%)",
            animation: "ruleta-halo 1.4s ease-out infinite",
          }}
          aria-hidden
        />
      )}

      {/* Flecha */}
      <svg viewBox="0 0 40 36" className="absolute left-1/2 top-[-10px] z-20 w-10 -translate-x-1/2 drop-shadow-lg" aria-hidden>
        <defs>
          <linearGradient id="r-flecha" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff8a3c" />
            <stop offset="1" stopColor="#ff5a00" />
          </linearGradient>
        </defs>
        <path d="M4 3 H36 L20 33 Z" fill="url(#r-flecha)" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>

      <svg viewBox={`0 0 ${TAM} ${TAM}`} className="relative h-full w-full drop-shadow-[0_18px_40px_rgba(0,0,0,.5)]">
        <defs>
          <linearGradient id="r-aro" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ff6a00" />
            <stop offset=".5" stopColor="#f2357e" />
            <stop offset="1" stopColor="#7a3db8" />
          </linearGradient>
          <linearGradient id="r-super" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff6a00" />
            <stop offset="1" stopColor="#ff9a3c" />
          </linearGradient>
        </defs>

        {/* Aro en el degradé de KORA y aro negro */}
        <circle cx={C} cy={C} r={C - 2} fill="url(#r-aro)" />
        <circle cx={C} cy={C} r={R + 7} fill="#121212" />

        <g
          style={{
            transform: `rotate(${rotacion}deg)`,
            transformOrigin: "50% 50%",
            transition: girando ? `transform ${duracionMs}ms cubic-bezier(.12,.72,.08,1)` : "none",
          }}
        >
          {premios.map((p, i) => {
            const color = colores[i];
            const centro = i * seg + seg / 2;
            return (
              <g key={p.key}>
                <path d={tajadaPath(i, seg)} fill={color ? color.fondo : "url(#r-super)"} stroke="#121212" strokeWidth="1.5" />
                <g
                  transform={`rotate(${centro} ${C} ${C})`}
                  textAnchor="middle"
                  fontFamily="Manrope, Arial, sans-serif"
                >
                  {p.super && (
                    <text x={C} y={C - R + 23} fontSize="11.5" fontWeight="800" fill="#ffffff" letterSpacing=".5">
                      SÚPER PREMIO
                    </text>
                  )}
                  <text
                    x={C}
                    y={C - R + (p.super ? 51 : 45)}
                    fontSize={p.grande.length > 5 ? 23 : 30}
                    fontWeight="900"
                    fill={color ? color.grande : "#ffffff"}
                  >
                    {p.grande}
                  </text>
                  <text
                    x={C}
                    y={C - R + (p.super ? 69 : 64)}
                    fontSize="12.5"
                    fontWeight="800"
                    fill={color ? color.chico : "#121212"}
                  >
                    {p.chico}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Al frenar: las demás se apagan y la ganadora brilla */}
          {ganador && !girando &&
            premios.map((p, i) =>
              p.key === ganador ? (
                <path
                  key={`foco-${p.key}`}
                  d={tajadaPath(i, seg, R - 3)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinejoin="round"
                  style={{ animation: "ruleta-foco .7s ease-in-out infinite", filter: "drop-shadow(0 0 6px #fff)" }}
                />
              ) : (
                <path key={`sombra-${p.key}`} d={tajadaPath(i, seg)} fill="#121212" opacity=".55" />
              ),
            )}
        </g>

        {/* Bombillos: titilan mientras gira y al caer el premio */}
        {Array.from({ length: 24 }, (_, i) => {
          const b = punto(i * 15, C - 8);
          const anima = girando || ganador;
          return (
            <circle
              key={i}
              cx={b.x}
              cy={b.y}
              r="3"
              fill={i % 2 ? "#ffffff" : "#ffd9bf"}
              style={anima ? { animation: `ruleta-luz ${girando ? ".35s" : ".6s"} ${(i % 2) * 0.17}s infinite` } : undefined}
            />
          );
        })}

        {/* Botón central */}
        <circle cx={C} cy={C} r="36" fill="url(#r-aro)" />
        <circle cx={C} cy={C} r="31" fill="#121212" />
        <path d={`M${C - 9} ${C - 29} L${C} ${C - 44} L${C + 9} ${C - 29} Z`} fill="#121212" />
        <text x={C} y={C + 6} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800" fontFamily="Manrope, Arial, sans-serif">
          Girar
        </text>
      </svg>
    </div>
  );
}

/** Estrellas y confeti que caen sobre la celebración. */
export function Lluvia() {
  const colores = ["#ff6a00", "#f2357e", "#7a3db8", "#ffd166", "#ffffff"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[86] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes ruleta-cae{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}
        @keyframes ruleta-brillo{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1.25);opacity:1}}
      `}</style>
      {Array.from({ length: 46 }, (_, i) => {
        const estrella = i % 3 === 0;
        return (
          <span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${(i * 23 + 7) % 100}%`,
              animation: `ruleta-cae ${2.4 + (i % 6) * 0.45}s ${(i % 9) * 0.18}s linear infinite`,
            }}
          >
            {estrella ? (
              <svg viewBox="0 0 24 24" width={12 + (i % 4) * 4} style={{ animation: "ruleta-brillo 1s ease-in-out infinite" }}>
                <path
                  d="M12 1l2.9 7.1L22 9l-5.5 4.8L18 21l-6-3.8L6 21l1.5-7.2L2 9l7.1-.9z"
                  fill={i % 2 ? "#ffd166" : "#ffffff"}
                />
              </svg>
            ) : (
              <span className="block h-3 w-1.5 rounded-[1px]" style={{ background: colores[i % colores.length] }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** La etiqueta del premio: un cupón con los colores de KORA, sin texto de más. */
export function Etiqueta({ etiqueta, grande, frase, pop }: { etiqueta: string; grande: string; frase: string; pop: boolean }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[330px]"
      style={pop ? { animation: "ruleta-pop .75s cubic-bezier(.2,1.6,.4,1) both" } : undefined}
    >
      <style>{`@keyframes ruleta-pop{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      <div
        className="relative overflow-hidden rounded-[24px] px-7 py-6 text-center text-white shadow-[0_18px_40px_rgba(242,53,126,.45)]"
        style={{ background: "linear-gradient(120deg,#ff6a00 0%,#f2357e 60%,#7a3db8 100%)" }}
      >
        <p className="text-[12px] font-extrabold uppercase tracking-[.22em] text-white/85">{etiqueta}</p>
        <p className="mt-1 text-[60px] font-black leading-none tracking-tight">{grande}</p>
        <p className="mx-auto mt-2 max-w-[240px] text-[17px] font-bold leading-snug">{frase}</p>
      </div>
    </div>
  );
}

export type Uso = { donde: string; como: string; hasta: string };

/** Cómo usar el premio: dónde, cómo y hasta cuándo, en grande y sin rodeos. */
export function ComoUsar({ titulo, rotulos, uso }: { titulo: string; rotulos: Uso; uso: Uso }) {
  const filas = [
    { Icono: MapPin, rotulo: rotulos.donde, texto: uso.donde },
    { Icono: ShoppingBag, rotulo: rotulos.como, texto: uso.como },
    { Icono: CalendarClock, rotulo: rotulos.hasta, texto: uso.hasta },
  ];
  return (
    <div className="mx-auto mt-4 w-full max-w-[330px] rounded-[22px] bg-white px-5 py-4 text-left text-kora-black shadow-lg">
      <p className="text-[15px] font-extrabold">{titulo}</p>
      <ul className="mt-3 grid gap-3">
        {filas.map(({ Icono, ...f }) => (
          <li key={f.rotulo} className="flex items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full text-white"
              style={{ background: "linear-gradient(135deg,#ff6a00,#f2357e 60%,#7a3db8)" }}
              aria-hidden
            >
              <Icono className="size-[18px]" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#ff5a1f]">{f.rotulo}</p>
              <p className="text-[15px] font-semibold leading-snug">{f.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
