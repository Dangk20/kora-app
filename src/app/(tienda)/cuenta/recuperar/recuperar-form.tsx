"use client";

// Recuperar la contraseña, en dos pasos dentro de la misma pantalla.
//
// El correo se pide una vez y viaja al segundo paso en un campo oculto: hacer
// que lo escriba dos veces es una forma de que se equivoque en el segundo y no
// entienda por qué el código "no sirve".

import { useActionState, useState } from "react";
import Link from "next/link";
import { confirmarCodigo, pedirCodigo, type FormState } from "../actions";

const input =
  "w-full min-h-12 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-[15px] py-3 text-base sm:text-sm outline-none focus:border-kora-coral";
const label = "mb-1.5 block text-[13px] font-semibold";
const boton =
  "min-h-12 w-full rounded-full bg-kora-gradient px-6 text-[15px] font-semibold text-white disabled:opacity-60";

export function RecuperarForm() {
  const [paso, setPaso] = useState<"pedir" | "confirmar">("pedir");
  const [correo, setCorreo] = useState("");

  const [envio, accionPedir, enviando] = useActionState<FormState, FormData>(
    async (prev, form) => {
      const r = await pedirCodigo(prev, form);
      // Se pasa al segundo paso SIEMPRE, tenga cuenta el correo o no: si solo
      // avanzara cuando existe, la propia pantalla diría cuáles existen.
      if (r?.ok) {
        setCorreo(String(form.get("email") ?? ""));
        setPaso("confirmar");
      }
      return r;
    },
    null,
  );

  const [cambio, accionConfirmar, confirmando] = useActionState<FormState, FormData>(
    confirmarCodigo,
    null,
  );

  if (paso === "pedir") {
    return (
      <form action={accionPedir} className="space-y-4">
        <div>
          <label className={label} htmlFor="email">
            Tu correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            className={input}
          />
        </div>

        {envio?.error ? (
          <p className="rounded-[11px] border border-[#e2ddd6] bg-[#F7F4F0] px-4 py-3 text-[13px] text-[#4B4350]">
            {envio.error}
          </p>
        ) : null}

        <button type="submit" disabled={enviando} className={boton}>
          {enviando ? "Enviando…" : "Enviarme el código"}
        </button>

        <p className="text-center text-[13px] text-muted-foreground">
          <Link href="/cuenta/entrar" className="underline">
            Volver a entrar
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form action={accionConfirmar} className="space-y-4">
      <p className="rounded-[11px] border border-[#e2ddd6] bg-[#F7F4F0] px-4 py-3 text-[13px] text-[#4B4350]">
        {envio?.error}
      </p>

      <input type="hidden" name="email" value={correo} />

      <div>
        <label className={label} htmlFor="code">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className={`${input} text-center text-[22px] tracking-[0.35em] font-semibold`}
        />
      </div>

      <div>
        <label className={label} htmlFor="password">
          Tu contraseña nueva
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={input}
        />
      </div>

      {cambio?.error ? (
        <p
          role="alert"
          className="rounded-[11px] border border-[#f0c7bd] bg-[#FDF1EE] px-4 py-3 text-[13px] text-[#8a3520]"
        >
          {cambio.error}
        </p>
      ) : null}

      <button type="submit" disabled={confirmando} className={boton}>
        {confirmando ? "Cambiando…" : "Cambiar mi contraseña"}
      </button>

      <p className="text-center text-[13px] text-muted-foreground">
        ¿No te llegó?{" "}
        <button
          type="button"
          onClick={() => setPaso("pedir")}
          className="underline"
        >
          Pedir otro código
        </button>
      </p>
    </form>
  );
}
