"use client";

// La ruleta de la gran apertura, al estilo de la de Temu (referencias de
// Daniel, 17 oct 2026) y con los colores de KORA: una ventana sobre la tienda,
// título grande, la ruleta con la flecha arriba, "Girar" en el centro y un
// botón naranja grande debajo.
//
// Primero se ve la ruleta (el gancho) y al tocar "Girar" se pide la cuenta.
// El premio lo decide el servidor (`girarRuleta`); aquí solo se anima la
// ruleta hasta la tajada que llegó, se ilumina y se celebra.

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/modules/i18n/provider";
import { girarRuleta, registrarParaGirar } from "./actions";
import { ComoUsar, Etiqueta, Lluvia, Rueda, type Tajada } from "./ruleta-rueda";
import { celularColombiano, correoValido, sugerenciaCorreo } from "@/modules/ruleta/validacion";

type Props = {
  premios: Tajada[];
  activa: boolean;
  conSesion: boolean;
  nombre: string | null;
  tieneCelular: boolean;
  giro: { premio: string; titulo: string; vence: string } | null;
  legal: { datos: string; terminos: string };
};

const VUELTAS = 7;
const DURACION_MS = 5600;
/** Cuánto brilla la tajada ganadora antes de la celebración. */
const FOCO_MS = 1500;

type Fase = "listo" | "girando" | "foco" | "celebra" | "visto";

export function RuletaView({ premios, activa, conSesion, nombre, tieneCelular, giro, legal }: Props) {
  const t = useMessages().ruleta;
  const seg = 360 / premios.length;
  const centroDe = (key: string) => {
    const i = premios.findIndex((p) => p.key === key);
    return i < 0 ? 0 : i * seg + seg / 2;
  };

  // Arranca con el súper premio bajo la flecha; si ya giró, con SU premio.
  const [rotacion, setRotacion] = useState(() => -centroDe(giro?.premio ?? premios.find((p) => p.super)?.key ?? ""));
  const [fase, setFase] = useState<Fase>(giro ? "visto" : "listo");
  const [resultado, setResultado] = useState<{ premio: string; titulo: string; vence: string } | null>(giro);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<"ruleta" | "registro">("ruleta");
  const [sesion, setSesion] = useState(conSesion);
  const [saludo, setSaludo] = useState(nombre);
  const [celular, setCelular] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [registro, registrar] = useActionState(registrarParaGirar, null);
  const ultimoRegistro = useRef<typeof registro>(null);

  function animarHasta(key: string) {
    // La tajada queda bajo la flecha (arriba, 0°) cuando la rueda gira
    // -(su centro). Un poco de juego, sin acercarse al borde de la tajada.
    const juego = (Math.random() - 0.5) * seg * 0.4;
    const destino = 360 - centroDe(key) + juego;
    setRotacion((r) => r - (((r % 360) + 360) % 360) + VUELTAS * 360 + destino);
    setFase("girando");
    window.setTimeout(() => setFase("foco"), DURACION_MS + 100);
    window.setTimeout(() => setFase("celebra"), DURACION_MS + 100 + FOCO_MS);
  }

  function pedirGiro(celularEscrito?: string) {
    iniciar(async () => {
      const r = await girarRuleta(celularEscrito);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResultado({ premio: r.premio, titulo: r.titulo, vence: r.vence });
      animarHasta(r.premio);
    });
  }

  function girar() {
    setError(null);
    if (!sesion) {
      setPaso("registro");
      return;
    }
    pedirGiro(tieneCelular ? undefined : celular);
  }

  // Cuenta creada: se vuelve a la ruleta y se gira de una, que es lo que la
  // persona pidió al tocar "Crear cuenta y girar".
  useEffect(() => {
    if (!registro?.ok || ultimoRegistro.current === registro) return;
    ultimoRegistro.current = registro;
    setSesion(true);
    setSaludo(registro.nombre ?? null);
    setPaso("ruleta");
    pedirGiro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro]);

  const ganadora = resultado ? premios.find((p) => p.key === resultado.premio) ?? null : null;
  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
  const uso =
    resultado && ganadora
      ? {
          donde: ganadora.kind === "CASHBACK" ? t.como.online : t.como.tienda,
          como:
            ganadora.kind === "CASHBACK" ? t.como.cashback : ganadora.kind === "PRODUCTO_GRATIS" ? t.como.regalo : t.como.descuento,
          hasta: t.como.fecha(fecha(resultado.vence)),
        }
      : null;
  const rotulos = { donde: t.como.donde, como: t.como.como, hasta: t.como.hasta };
  const ocupado = pendiente || fase === "girando" || fase === "foco";
  const mostrarGanador = fase === "foco" || fase === "celebra" || fase === "visto";

  return (
    // z-75: por encima del aviso de cookies (z-60), que en un celular nuevo
    // tapaba el botón de crear la cuenta.
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-[#121212]/80 px-4 pb-10 pt-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden backdrop-blur-[2px]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(circle at 50% 38%, rgba(242,53,126,.28), transparent 60%)" }}
        aria-hidden
      />
      <Link
        href="/"
        aria-label={t.cerrar}
        className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/70 text-white"
      >
        <X className="size-5" />
      </Link>

      <div className="relative w-full max-w-[380px] text-center">
        <h1 className="text-[30px] font-extrabold italic leading-tight text-white drop-shadow">{t.titulo}</h1>
        <span className="mt-2 inline-block rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[13px] font-semibold text-white">
          {t.etiqueta}
        </span>

        {!activa && !giro ? (
          <p className="mt-10 rounded-2xl bg-white/95 px-5 py-6 text-[15px] font-semibold text-kora-black">{t.cerrada}</p>
        ) : paso === "registro" ? (
          <Registro action={registrar} error={registro?.error} legal={legal} onVolver={() => setPaso("ruleta")} />
        ) : (
          <>
            {/* El premio, arriba de la ruleta, una vez que cayó */}
            {fase === "visto" && resultado && ganadora && (
              <div className="mt-6">
                <p className="mb-3 text-[13px] font-bold uppercase tracking-[.14em] text-[#ff8a3c]">
                  {giro ? t.yaGiraste : t.ganaste}
                </p>
                <Etiqueta etiqueta={t.tuPremio} grande={ganadora.grande} frase={ganadora.frase} pop={false} />
                {uso && <ComoUsar titulo={t.como.titulo} rotulos={rotulos} uso={uso} />}
              </div>
            )}

            {/* Ya giró: solo el premio y cómo usarlo, sin la ruleta debajo (sin scroll) */}
            <div className={fase === "visto" ? "hidden" : "mt-7"}>
              <Rueda
                premios={premios}
                rotacion={rotacion}
                girando={fase === "girando"}
                duracionMs={DURACION_MS}
                ganador={mostrarGanador ? (resultado?.premio ?? null) : null}
              />
            </div>

            {fase === "visto" && resultado ? (
              <Acciones />
            ) : (
              <div className="mt-7 grid gap-3">
                {saludo && sesion && <p className="text-[15px] font-semibold text-white">¡Hola, {saludo}!</p>}
                {sesion && !tieneCelular && fase === "listo" && (
                  <Input
                    value={celular}
                    onChange={(e) => setCelular(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t.celularParaGirar}
                    className="h-12 rounded-full border-0 bg-white text-center text-[15px]"
                  />
                )}
                {error && (
                  <p role="alert" className="rounded-xl bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={girar}
                  disabled={ocupado || fase === "celebra"}
                  className="rounded-full bg-gradient-to-b from-[#ff8a3c] to-[#ff5a00] py-4 text-[19px] font-extrabold text-white shadow-[0_6px_0_#c94400] transition active:translate-y-[3px] active:shadow-[0_3px_0_#c94400] disabled:opacity-80"
                >
                  {ocupado ? t.girando : t.girar}
                </button>
                <p className="text-[13px] font-medium text-white/85">{t.probabilidad}</p>
                <p className="text-[12px] text-white/60">{t.unGiro}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* La celebración: estrellas, "¡Ganaste!" y la etiqueta del premio */}
      {fase === "celebra" && resultado && ganadora && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-[#121212]/90 px-4 pb-10 pt-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Lluvia />
          <div className="relative z-[87] w-full max-w-[380px] text-center">
            <p
              className="text-[32px] font-black italic leading-tight text-white drop-shadow-[0_4px_14px_rgba(255,106,0,.6)]"
              style={{ animation: "ruleta-pop .6s cubic-bezier(.2,1.6,.4,1) both" }}
            >
              {ganadora.super ? t.ganasteSuper : t.ganaste}
            </p>
            <div className="mt-6">
              <Etiqueta etiqueta={t.tuPremio} grande={ganadora.grande} frase={ganadora.frase} pop />
              {uso && <ComoUsar titulo={t.como.titulo} rotulos={rotulos} uso={uso} />}
            </div>
            <Acciones />
          </div>
        </div>
      )}
    </div>
  );
}

function Acciones() {
  const t = useMessages().ruleta;
  return (
    <div className="mt-6 grid gap-2 text-white">
      <Link
        href="/cuenta"
        className="rounded-full bg-gradient-to-b from-[#ff8a3c] to-[#ff5a00] py-3.5 text-[17px] font-extrabold text-white shadow-[0_6px_0_#c94400]"
      >
        {t.verBeneficios}
      </Link>
      <Link href="/catalogo" className="py-2 text-[14px] font-semibold underline">
        {t.seguirComprando}
      </Link>
    </div>
  );
}

function Registro({
  action,
  error,
  legal,
  onVolver,
}: {
  action: (data: FormData) => void;
  error?: string;
  legal: { datos: string; terminos: string };
  onVolver: () => void;
}) {
  const t = useMessages().ruleta;
  const tc = useMessages().cuenta;
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");
  const [tocado, setTocado] = useState({ celular: false, correo: false });

  const celularOk = celularColombiano(celular) !== null;
  const correoOk = correoValido(correo) !== null;
  const sugerido = correoOk ? sugerenciaCorreo(correo) : null;
  const errCelular = tocado.celular && !celularOk ? t.registro.celularInvalido : null;
  const errCorreo = tocado.correo && !correoOk ? t.registro.correoInvalido : null;
  const borde = (mal: boolean) => (mal ? "border-[#e5484d] ring-2 ring-[#e5484d]/20" : "");

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        // Ni un dato de relleno: si algo no cumple, se marca y no se envía.
        if (!celularOk || !correoOk || sugerido) {
          e.preventDefault();
          setTocado({ celular: true, correo: true });
        }
      }}
      className="mt-6 grid gap-4 rounded-3xl bg-white px-5 py-6 text-left shadow-xl motion-safe:animate-[ruleta-sube_.5s_cubic-bezier(.22,1,.36,1)_both]"
    >
      {/* Entra subiendo suave desde abajo (Daniel, 17 oct). */}
      <style>{`@keyframes ruleta-sube{from{transform:translateY(48px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div>
        <h2 className="text-[20px] font-extrabold text-kora-black">{t.registro.titulo}</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t.registro.bajada}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-[#f3c7c7] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
          {error}
        </p>
      )}
      <div className="grid gap-2">
        <Label htmlFor="r-name">{t.registro.nombre}</Label>
        <Input id="r-name" name="name" autoComplete="name" required minLength={3} className="h-11 rounded-xl" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="r-phone">{t.registro.celular}</Label>
        <div className={`flex h-11 items-center overflow-hidden rounded-xl border bg-white ${borde(Boolean(errCelular))}`}>
          <span className="flex h-full items-center border-r bg-[#faf7f3] px-3 text-[14px] font-semibold text-kora-black">
            +57
          </span>
          <input
            id="r-phone"
            name="phone"
            value={celular}
            // Solo números y máximo 10: lo demás ni siquiera se escribe.
            onChange={(e) => setCelular(e.target.value.replace(/\D/g, "").slice(0, 10))}
            onBlur={() => setTocado((x) => ({ ...x, celular: true }))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="3001234567"
            maxLength={10}
            aria-invalid={Boolean(errCelular)}
            className="h-full w-full bg-transparent px-3 text-[15px] tracking-wide outline-none"
          />
        </div>
        <p className={`text-[12px] ${errCelular ? "font-semibold text-[#c2333a]" : "text-muted-foreground"}`}>
          {errCelular ?? t.registro.celularAyuda}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="r-email">{tc.correo}</Label>
        <Input
          id="r-email"
          name="email"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value.replace(/\s/g, "").toLowerCase())}
          onBlur={() => setTocado((x) => ({ ...x, correo: true }))}
          autoComplete="email"
          autoCapitalize="none"
          placeholder="nombre@gmail.com"
          aria-invalid={Boolean(errCorreo)}
          className={`h-11 rounded-xl ${borde(Boolean(errCorreo))}`}
        />
        {sugerido ? (
          <p className="text-[12.5px] font-semibold text-[#b25a12]">
            {t.registro.quisoDecir(sugerido)}{" "}
            <button type="button" onClick={() => setCorreo(sugerido)} className="text-[#ff5a1f] underline">
              {t.registro.usar}
            </button>
          </p>
        ) : (
          <p className={`text-[12px] ${errCorreo ? "font-semibold text-[#c2333a]" : "text-muted-foreground"}`}>
            {errCorreo ?? t.registro.correoAyuda}
          </p>
        )}
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-[#4a4f58]">
        <input type="checkbox" name="datos" required className="mt-0.5 size-4 accent-[#ff6a00]" />
        <span>
          {t.registro.datos}{" "}
          <a href={legal.terminos} target="_blank" rel="noreferrer" className="font-semibold underline">
            {t.registro.terminos}
          </a>
          {" · "}
          <a href={legal.datos} target="_blank" rel="noreferrer" className="underline">
            Habeas Data
          </a>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-[#4a4f58]">
        <input type="checkbox" name="promos" className="mt-0.5 size-4 accent-[#ff6a00]" />
        <span>{t.registro.promos}</span>
      </label>
      <Boton texto={t.registro.boton} enviando={t.registro.enviando} />
      <p className="text-center text-[13px]">
        {t.registro.yaTienes}{" "}
        <Link href="/cuenta/entrar?volver=/ruleta" className="font-semibold text-kora-black underline">
          {t.registro.entra}
        </Link>
      </p>
      <button type="button" onClick={onVolver} className="text-[13px] text-muted-foreground underline">
        ← {t.girar}
      </button>
    </form>
  );
}

function Boton({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded-full bg-gradient-to-b from-[#ff8a3c] to-[#ff5a00] py-3.5 text-[17px] font-extrabold text-white shadow-[0_5px_0_#c94400] disabled:opacity-80"
    >
      {pending ? enviando : texto}
    </button>
  );
}
