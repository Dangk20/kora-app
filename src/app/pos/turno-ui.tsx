"use client";

// Apertura, salidas de dinero y cierre de la caja (change s09-pos-caja).
// Pasos grandes y de a uno, como pidió Daniel: una pregunta por pantalla, y
// la misma animación de proceso del checkout cada vez que algo se guarda.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  LockKeyhole,
  MinusCircle,
  PiggyBank,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { formatMoney } from "@/modules/pricing";
import type { ResumenTurno } from "@/modules/pos/turno";
import { abrirCaja, cerrarCaja, dejarBaseCaja, registrarSalidaCaja, resumenCaja } from "@/modules/pos/actions";
import { ProcesoCobro, type PasoProceso } from "./proceso-cobro";

const money = (n: number) => formatMoney(n, "COP");
// El mismo ritmo de la pantalla del checkout: cada paso se alcanza a leer.
const MS_POR_PASO = 1100;
/** Cuánto se queda el check verde antes de pasar a la siguiente vista. */
const MS_LISTO = 1200;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fechaLarga = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }).format(d);
const hora = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(d);
const manana = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

/** Corre los pasos de la animación y espera también a la acción real. */
async function conProceso<T>(pasos: number, setPaso: (n: number) => void, accion: Promise<T>): Promise<T> {
  const relato = (async () => {
    for (let i = 1; i < pasos; i++) {
      await pausa(MS_POR_PASO);
      setPaso(i);
    }
    await pausa(MS_POR_PASO);
  })();
  const [r] = await Promise.all([accion, relato]);
  return r;
}

/** Campo de dinero en pesos con separador de miles mientras se escribe. */
function CampoPesos({ valor, onCambio, autoFocus, grande }: { valor: string; onCambio: (v: string) => void; autoFocus?: boolean; grande?: boolean }) {
  return (
    <div className={`flex items-center rounded-[14px] border-[1.8px] border-[#e2ddd6] bg-white px-5 focus-within:border-kora-coral ${grande ? "py-2" : ""}`}>
      <span className={`${grande ? "text-[30px]" : "text-[20px]"} font-bold text-[#9aa0ab]`}>$</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        autoComplete="off"
        value={valor ? Number(valor).toLocaleString("es-CO") : ""}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9))}
        placeholder="0"
        className={`w-full bg-transparent pl-2 font-extrabold tracking-tight outline-none placeholder:text-[#d6d0c8] ${grande ? "py-3 text-[38px]" : "py-3 text-[22px]"}`}
      />
    </div>
  );
}

const PASOS_APERTURA: PasoProceso[] = [
  { icono: Store, texto: "Abriendo el turno", detalle: "Caja 1" },
  { icono: PiggyBank, texto: "Registrando la base", detalle: "El efectivo con el que arrancas" },
  { icono: CalendarCheck, texto: "Preparando la caja", detalle: "Ya casi puedes vender" },
];

// ── Apertura: vista limpia, una pregunta por paso ──
export function AperturaCaja({ baseAnterior, cajero }: { baseAnterior: number | null; cajero: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"pregunta" | "base" | "abriendo" | "abierta">("pregunta");
  const [base, setBase] = useState(baseAnterior ? String(baseAnterior) : "");
  const [etapa, setEtapa] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState<Date | null>(null);

  // El reloj se monta en el cliente: la hora del servidor no es la del cajero.
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  async function abrir() {
    setError(null);
    setEtapa(0);
    setPaso("abriendo");
    const r = await conProceso(PASOS_APERTURA.length, setEtapa, abrirCaja(Number(base || 0)));
    if (r.ok) {
      // El anillo se cierra y el check verde se queda un momento; después se
      // trae la caja. Sin esto la animación se cortaba en el último paso.
      setPaso("abierta");
      await pausa(MS_LISTO);
      router.refresh();
    } else {
      setError(r.error);
      setPaso("base");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-[560px]">
        {paso === "pregunta" && (
          <div key="pregunta" className="turno-entra text-center">
            <span className="bg-kora-gradient mx-auto flex size-20 items-center justify-center rounded-full shadow-[0_14px_30px_-12px_rgba(255,90,31,0.6)]">
              <Store className="size-9 text-white" />
            </span>
            <p className="mt-8 text-[15px] font-semibold text-[#8a8f98]">Hola, {cajero.split(" ")[0]}</p>
            <h1 className="mt-2 text-[34px] leading-tight font-extrabold text-kora-black">
              ¿Deseas abrir la caja del {ahora ? fechaLarga(ahora) : "día"}?
            </h1>
            <p className="mt-3 text-[22px] font-bold text-kora-coral">{ahora ? hora(ahora) : " "}</p>
            <button type="button" onClick={() => setPaso("base")}
              className="bg-kora-gradient mx-auto mt-10 flex items-center gap-2 rounded-full px-10 py-4.5 text-[18px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(255,90,31,0.7)] hover:opacity-90">
              Iniciar apertura <ArrowRight className="size-5" />
            </button>
          </div>
        )}

        {paso === "base" && (
          <div key="base" className="turno-desliza">
            <button type="button" onClick={() => setPaso("pregunta")}
              className="mb-6 flex items-center gap-1.5 text-[14px] font-semibold text-[#8a8f98] hover:text-kora-black">
              <ArrowLeft className="size-4" /> Volver
            </button>
            <h2 className="text-[30px] leading-tight font-extrabold text-kora-black">
              {baseAnterior !== null ? "¿Con cuánta base vas a iniciar?" : "No hay una base del día anterior"}
            </h2>
            <p className="mt-2 text-[17px] text-[#6b6f78]">
              {baseAnterior !== null
                ? `El cierre anterior dejó ${money(baseAnterior)} en el cajón.`
                : "¿Con cuánta base vas a iniciar?"}
            </p>
            <div className="mt-7">
              <CampoPesos valor={base} onCambio={setBase} autoFocus grande />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 50_000, 100_000, 200_000].map((v) => (
                <button key={v} type="button" onClick={() => setBase(v ? String(v) : "")}
                  className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:bg-[#efe9e1]">
                  {v === 0 ? "Sin base" : money(v)}
                </button>
              ))}
            </div>
            {error && <p className="mt-4 rounded-[12px] bg-[#fdecec] px-4 py-3 text-[14px] font-semibold text-destructive">{error}</p>}
            <button type="button" onClick={() => void abrir()}
              className="bg-kora-gradient mt-8 flex w-full items-center justify-center gap-2 rounded-full px-8 py-4.5 text-[18px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(255,90,31,0.7)] hover:opacity-90">
              Abrir caja{base ? ` con ${money(Number(base))}` : " sin base"}
            </button>
          </div>
        )}

        {(paso === "abriendo" || paso === "abierta") && (
          <div className="relative overflow-hidden rounded-[24px] bg-white p-10 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
            <ProcesoCobro pasos={PASOS_APERTURA} paso={etapa} listo={paso === "abierta"} />
            {paso === "abierta" && (
              <div className="turno-entra mt-5 text-center">
                <p className="text-[24px] font-extrabold text-kora-black">¡Caja abierta!</p>
                <p className="mt-1 text-[14px] text-[#8a8f98]">Base de {money(Number(base || 0))} · preparando la caja…</p>
              </div>
            )}
          </div>
        )}
      </div>
      <EstilosTurno />
    </div>
  );
}

// ── Las acciones del turno abierto, en el encabezado de la caja ──
export function AccionesTurno({
  turno,
}: {
  turno: { id: string; openedAt: string; openingBase: number; openedByName: string };
}) {
  const [salida, setSalida] = useState(false);
  const [cierre, setCierre] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setSalida(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-white hover:bg-white/10">
          <MinusCircle className="size-4" /> Salida de dinero
        </button>
        <button type="button" onClick={() => setCierre(true)}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-kora-black hover:opacity-90">
          <LockKeyhole className="size-4" /> Cerrar caja
        </button>
      </div>
      {salida && (
        <SalidaDinero
          onCerrar={() => setSalida(false)}
          onGuardada={(monto) => {
            setSalida(false);
            setAviso(`Salida de ${money(monto)} registrada`);
            setTimeout(() => setAviso(null), 4000);
          }}
        />
      )}
      {cierre && <CierreCaja sessionId={turno.id} onCancelar={() => setCierre(false)} />}
      {/* Notificación flotante, abajo y al centro: no empuja nada de la caja. */}
      {aviso && (
        <div role="status" aria-live="polite"
          className="turno-toast fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-kora-black px-5 py-3 text-[14px] font-semibold text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
          <CheckCircle2 className="size-5 text-[#5fd08a]" /> {aviso}
        </div>
      )}
      <EstilosTurno />
    </>
  );
}

// ── Salida de dinero (compra para el local, domicilio…) ──
function SalidaDinero({ onCerrar, onGuardada }: { onCerrar: () => void; onGuardada: (monto: number) => void }) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setError(null);
    setGuardando(true);
    const r = await registrarSalidaCaja(Number(monto || 0), motivo);
    setGuardando(false);
    if (r.ok) onGuardada(Number(monto));
    else setError(r.error);
  }
  return (
    <Fondo etiqueta="Salida de dinero" onCerrar={onCerrar}>
      <h2 className="text-[22px] font-extrabold text-kora-black">Salida de dinero</h2>
      <p className="mt-1 text-[13.5px] text-[#8a8f98]">Efectivo que sale del cajón y no es una venta. Se descuenta en el cierre.</p>
      <div className="mt-5">
        <CampoPesos valor={monto} onCambio={setMonto} autoFocus />
      </div>
      <input aria-label="Motivo de la salida" placeholder="¿En qué se usó? Ej.: bolsas, domicilio, aseo"
        value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
        className="mt-3 w-full rounded-[12px] border-[1.6px] border-[#e2ddd6] px-4 py-3 text-[15px] outline-none focus:border-kora-coral" />
      {error && <p className="mt-3 rounded-[10px] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
      <button type="button" disabled={guardando || !monto || motivo.trim().length < 3} onClick={() => void guardar()}
        className="bg-kora-gradient mt-5 w-full rounded-full px-6 py-4 text-[16px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
        {guardando ? "Registrando…" : `Registrar salida${monto ? ` de ${money(Number(monto))}` : ""}`}
      </button>
    </Fondo>
  );
}

const PASOS_RESUMEN: PasoProceso[] = [
  { icono: BarChart3, texto: "Sumando las ventas del día", detalle: "Por cada método de pago" },
  { icono: MinusCircle, texto: "Restando las salidas de dinero", detalle: "Lo que salió del cajón" },
  { icono: Wallet, texto: "Calculando el efectivo en caja", detalle: "Base + efectivo − salidas" },
];
const PASOS_CIERRE: PasoProceso[] = [
  { icono: LockKeyhole, texto: "Cerrando la caja", detalle: "Ya no se registran ventas en este turno" },
  { icono: BarChart3, texto: "Guardando el resumen", detalle: "Queda como reporte del día" },
  { icono: CheckCircle2, texto: "Cierre listo", detalle: "Un momento…" },
];

// ── Cierre: resumen → ejecutar cierre → ¿base para mañana? ──
function CierreCaja({ sessionId, onCancelar }: { sessionId: string; onCancelar: () => void }) {
  const router = useRouter();
  const [fase, setFase] = useState<
    "calculando" | "calculado" | "resumen" | "cerrando" | "exitoso" | "base" | "terminando"
  >("calculando");
  const [etapa, setEtapa] = useState(0);
  const [resumen, setResumen] = useState<ResumenTurno | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState("");

  useEffect(() => {
    void (async () => {
      const r = await conProceso(PASOS_RESUMEN.length, setEtapa, resumenCaja(sessionId));
      setResumen(r);
      // Cerrar el anillo antes de mostrar el resumen, no cortarlo a mitad.
      setFase("calculado");
      await pausa(MS_LISTO * 0.6);
      setFase("resumen");
    })();
  }, [sessionId]);

  async function ejecutarCierre() {
    setError(null);
    setEtapa(0);
    setFase("cerrando");
    const r = await conProceso(PASOS_CIERRE.length, setEtapa, cerrarCaja(sessionId));
    if (r.ok) {
      setResumen(r.resumen);
      // Se sugiere repetir la base con la que se abrió; el cajero la cambia.
      setBase(r.resumen.base > 0 ? String(r.resumen.base) : "");
      setFase("exitoso");
    } else {
      setError(r.error);
      setFase("resumen");
    }
  }

  async function terminar(monto: number | null) {
    setFase("terminando");
    await Promise.all([dejarBaseCaja(sessionId, monto), pausa(MS_LISTO)]);
    // La caja vuelve a la vista limpia de apertura.
    router.refresh();
  }

  if (fase === "calculando" || fase === "calculado" || fase === "cerrando") {
    return (
      <Fondo etiqueta="Cierre de caja">
        <ProcesoCobro
          pasos={fase === "cerrando" ? PASOS_CIERRE : PASOS_RESUMEN}
          paso={etapa}
          listo={fase === "calculado"}
        />
        {fase === "calculado" && (
          <p className="turno-entra mt-5 text-center text-[18px] font-extrabold text-kora-black">Resumen listo</p>
        )}
      </Fondo>
    );
  }

  if (fase === "terminando") {
    return (
      <Fondo etiqueta="Cerrando el día">
        <ProcesoCobro pasos={PASOS_CIERRE} paso={2} listo />
        <p className="turno-entra mt-5 text-center text-[20px] font-extrabold text-kora-black">¡Hasta mañana!</p>
        <p className="mt-1 text-center text-[14px] text-[#8a8f98]">Dejando la caja lista para la próxima apertura…</p>
      </Fondo>
    );
  }

  if (fase === "exitoso" || fase === "base") {
    return (
      <Fondo etiqueta="Cierre exitoso">
        <ProcesoCobro pasos={PASOS_CIERRE} paso={2} listo />
        <p className="mt-4 text-center text-[24px] font-extrabold text-kora-black">¡Cierre exitoso!</p>
        {resumen && (
          <p className="mt-1 text-center text-[14px] text-[#8a8f98]">
            {resumen.ventas} ventas · {money(resumen.total)} · {money(resumen.efectivoEnCaja)} en efectivo
          </p>
        )}
        {fase === "exitoso" ? (
          <>
            <p className="mt-7 text-center text-[18px] font-bold text-kora-black">
              ¿Deseas dejar base para el {fechaLarga(manana())}?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void terminar(null)}
                className="rounded-full border-[1.6px] border-[#e2ddd6] px-5 py-3.5 text-[15px] font-bold text-kora-black hover:border-kora-coral">
                No, cerrar sin base
              </button>
              <button type="button" onClick={() => setFase("base")}
                className="bg-kora-gradient rounded-full px-5 py-3.5 text-[15px] font-bold text-white hover:opacity-90">
                Sí, dejar base
              </button>
            </div>
          </>
        ) : (
          <div className="turno-desliza mt-6">
            <p className="text-[16px] font-bold text-kora-black">¿Cuánto dejas en el cajón?</p>
            <div className="mt-3">
              <CampoPesos valor={base} onCambio={setBase} autoFocus />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFase("exitoso")}
                className="rounded-full border-[1.6px] border-[#e2ddd6] px-5 py-3.5 text-[15px] font-bold text-kora-black hover:border-kora-coral">
                Volver
              </button>
              <button type="button" disabled={!base} onClick={() => void terminar(Number(base))}
                className="bg-kora-gradient rounded-full px-5 py-3.5 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-45">
                Dejar {base ? money(Number(base)) : "base"}
              </button>
            </div>
          </div>
        )}
      </Fondo>
    );
  }

  // ── Resumen del día ──
  const r = resumen;
  const maximo = Math.max(1, ...(r?.porMetodo.map((m) => m.monto) ?? [1]));
  const COLORES = ["bg-kora-gradient", "bg-[#7a3db8]", "bg-[#f2357e]", "bg-[#3c3c3c]"];
  return (
    <Fondo etiqueta="Resumen del día" onCerrar={onCancelar} ancho>
      {!r ? (
        <p className="text-center text-[14px] text-destructive">No se pudo leer el turno.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-[13px] font-bold tracking-[1.5px] text-[#8a8f98] uppercase">Ventas del día</p>
            <p className="mt-1 text-[40px] leading-tight font-extrabold text-kora-black">{money(r.total)}</p>
            <p className="text-[14px] text-[#6b6f78]">{r.ventas} {r.ventas === 1 ? "venta" : "ventas"}</p>

            {/* Barras horizontales por método: se comparan montos de un vistazo,
                mejor que una torta en una pantalla de caja. */}
            <div className="mt-6 space-y-4">
              {r.porMetodo.map((m, i) => {
                const pct = r.total > 0 ? Math.round((m.monto / r.total) * 100) : 0;
                return (
                  <div key={m.metodo}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[14px]">
                      <span className="font-bold text-kora-black">{m.metodo}</span>
                      <span className="text-[#4a4f58]">
                        <b className="text-kora-black">{money(m.monto)}</b> · {pct}% · {m.ventas} {m.ventas === 1 ? "venta" : "ventas"}
                      </span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-[#f0ece6]">
                      <div className={`h-full rounded-full ${COLORES[i % COLORES.length]} turno-barra`}
                        style={{ width: `${(m.monto / maximo) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col md:border-l md:border-[#f0ece6] md:pl-6">
            <p className="text-[13px] font-bold tracking-[1.5px] text-[#8a8f98] uppercase">Efectivo en caja</p>
            <div className="mt-3 space-y-2 text-[14px]">
              <Fila etiqueta="Base de apertura" valor={money(r.base)} />
              <Fila etiqueta="Ventas en efectivo" valor={`+ ${money(r.porMetodo.find((m) => m.metodo === "Efectivo")?.monto ?? 0)}`} />
              <Fila etiqueta={`Salidas de dinero (${r.salidas.length})`} valor={`− ${money(r.totalSalidas)}`} rojo={r.totalSalidas > 0} />
            </div>
            {r.salidas.length > 0 && (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-[10px] bg-[#fbfaf8] px-3 py-2 text-[12.5px] text-[#6b6f78]">
                {r.salidas.map((s, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{hora(new Date(s.hora))} · {s.motivo}</span>
                    <span className="shrink-0 font-semibold">{money(s.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="bg-kora-gradient mt-4 flex items-center justify-between rounded-[16px] px-5 py-4 text-white">
              <span className="text-[14px] font-bold uppercase">Debe haber en el cajón</span>
              <span className="text-[28px] font-extrabold">{money(r.efectivoEnCaja)}</span>
            </div>
            {error && <p className="mt-3 rounded-[10px] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}
            <div className="mt-auto pt-6">
              <button type="button" onClick={() => void ejecutarCierre()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-kora-black px-6 py-4 text-[16px] font-bold text-white hover:opacity-90">
                <LockKeyhole className="size-5" /> Ejecutar cierre
              </button>
              <button type="button" onClick={onCancelar} className="mt-2 w-full py-2 text-[13.5px] font-semibold text-[#8a8f98] hover:text-kora-black">
                Seguir vendiendo
              </button>
            </div>
          </div>
        </div>
      )}
    </Fondo>
  );
}

function Fila({ etiqueta, valor, rojo }: { etiqueta: string; valor: string; rojo?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6b6f78]">{etiqueta}</span>
      <span className={`font-bold ${rojo ? "text-destructive" : "text-kora-black"}`}>{valor}</span>
    </div>
  );
}

function Fondo({ etiqueta, children, onCerrar, ancho }: { etiqueta: string; children: React.ReactNode; onCerrar?: () => void; ancho?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={etiqueta}>
      <div className={`relative max-h-[92dvh] w-full overflow-hidden overflow-y-auto rounded-[22px] bg-white p-7 shadow-xl ${ancho ? "max-w-[880px]" : "max-w-[460px]"}`}>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar"
            className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-[#9aa0ab] hover:bg-[#f5f3f0] hover:text-kora-black">
            <X className="size-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function EstilosTurno() {
  return (
    <style>{`
      @keyframes turnoEntra { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      @keyframes turnoDesliza { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
      @keyframes turnoBarra { from { width: 0; } }
      @keyframes turnoToast { from { opacity: 0; translate: -50% 16px; } to { opacity: 1; translate: -50% 0; } }
      .turno-toast { animation: turnoToast 360ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .turno-entra { animation: turnoEntra 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .turno-desliza { animation: turnoDesliza 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .turno-barra { animation: turnoBarra 800ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      @media (prefers-reduced-motion: reduce) { .turno-entra, .turno-desliza, .turno-barra, .turno-toast { animation: none !important; } }
    `}</style>
  );
}
