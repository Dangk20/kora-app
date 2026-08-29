"use client";

// La invitación de cuenta al terminar la compra. Dos caras:
//
//   · Sin cuenta  → "Crea tu cuenta", y solo se le pide la contraseña.
//   · Con cuenta  → "¿Quieres entrar para ver este pedido?".
//
// Aparece en el único momento en que la propuesta se explica sola: el pedido ya
// existe y hay algo concreto que ganar —verlo, seguirlo, y su cashback—.
//
// ⚠️ EL PEDIDO YA ESTÁ ATADO A SU CLIENTE antes de esta pantalla, por el correo
// y dentro de la transacción de la compra. Entrar o registrarse sirve para
// VERLO ahora; decir "en otro momento" no le quita nada. Por eso el texto dice
// "para verlo" y nunca "para que quede a tu nombre": eso ya pasó.
//
// Pantalla y no modal, a propósito: un modal encima de la pantalla de compra le
// pide a alguien que decida sin contexto y con la sensación de que le tapan
// algo. Aquí la compra ya está hecha, se le dice, y luego se le ofrece.
//
// No bloquea la venta. "En otro momento" lleva a WhatsApp igual que hoy, y está
// escrito como un enlace y no como un botón: no es la opción principal, pero
// tampoco se esconde. Esconder la salida es lo que convierte una invitación en
// una trampa.

import { useState, useTransition } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { crearCuentaDelPedido, entrarDesdePedido } from "./cuenta-actions";

const input =
  "w-full min-h-12 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-[15px] py-3 text-base sm:text-sm outline-none focus:border-kora-coral";

export function InvitacionCuenta({
  orderNumber,
  checkoutToken,
  cashback,
  tieneCuenta,
  onContinuar,
}: {
  orderNumber: string;
  checkoutToken: string;
  /**
   * Ya formateado por el servidor, en la moneda del pedido. `null` cuando el
   * pedido no genera nada —pagado entero con saldo—: enseñar "$0" en una lista
   * de beneficios se lee como un fallo, no como un cero.
   */
  cashback: string | null;
  /** Si ese correo YA tiene cuenta: entonces se le ofrece entrar, no crearla. */
  tieneCuenta: boolean;
  /** Seguir a WhatsApp: es lo que pasa decida lo que decida. */
  onContinuar: () => void;
}) {
  const [paso, setPaso] = useState<"oferta" | "password">("oferta");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnviando] = useTransition();

  const enviar = (form: FormData) => {
    setError(null);
    startEnviando(async () => {
      const r = tieneCuenta
        ? await entrarDesdePedido(checkoutToken, String(form.get("password") ?? ""))
        : await crearCuentaDelPedido(
            checkoutToken,
            String(form.get("password") ?? ""),
            String(form.get("password2") ?? ""),
          );
      // Salga bien o mal, WhatsApp sigue estando a un clic: la compra nunca
      // queda atrapada detrás de esta pantalla.
      if (r.ok) onContinuar();
      else setError(r.error);
    });
  };

  return (
    <div className="mx-auto max-w-[520px] px-6 py-14">
      <div className="rounded-[20px] bg-white p-7 text-center shadow-[0_6px_28px_rgba(0,0,0,0.05)] sm:p-9">
        <span className="mx-auto flex size-[68px] items-center justify-center rounded-full bg-[#EEF7EF]">
          <CheckCircle2 className="size-8 text-[#2c6b34]" />
        </span>

        <h1 className="mt-5 text-[24px] leading-tight font-extrabold text-kora-black">
          Tu pedido {orderNumber} está listo
        </h1>

        {paso === "oferta" ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-[#4a4f58]">
              {tieneCuenta
                ? "Ya tienes una cuenta con este correo. ¿Quieres entrar para seguir este pedido desde ahí?"
                : "Guarda tus datos y sigue este pedido desde tu cuenta. Solo tienes que elegir una contraseña — el resto ya lo tenemos."}
            </p>

            <ul className="mt-6 space-y-2.5 text-left">
              {[
                "Sigue el estado de este pedido y de los que vengan",
                // EN FUTURO, y no por prudencia de redacción: el cashback se
                // acredita al CONFIRMAR el pedido, y aquí el pedido acaba de
                // nacer pendiente. Escrito en pasado mandaría a buscar un
                // saldo que el libro todavía no tiene. Misma regla que la
                // pantalla de pedidos del comprador.
                cashback ? `Generará ${cashback} de Kora Cashback a tu nombre` : null,
                tieneCuenta
                  ? "Este pedido ya quedó en tu cuenta: entrar solo es para verlo ahora"
                  : "Compra más rápido: no vuelves a escribir tus datos",
              ]
                .filter(Boolean)
                .map((t) => (
                  <li key={t as string} className="flex gap-2.5 text-[14px] text-[#4a4f58]">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-kora-orange" />
                    <span>{t}</span>
                  </li>
                ))}
            </ul>

            <button
              type="button"
              onClick={() => setPaso("password")}
              className="bg-kora-gradient mt-7 min-h-13 w-full rounded-full px-7 text-[16px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)]"
            >
              {tieneCuenta ? "Iniciar sesión" : "Crear mi cuenta"}
            </button>

            {/* Enlace y no botón: se ve, se toca y no compite. */}
            <button
              type="button"
              onClick={onContinuar}
              className="mt-4 w-full text-[14px] text-muted-foreground underline underline-offset-2"
            >
              {tieneCuenta ? "No, en otro momento" : "En otro momento"}
            </button>
          </>
        ) : (
          <form action={enviar} className="mt-5 text-left">
            <p className="text-center text-[14.5px] text-[#4a4f58]">
              {tieneCuenta
                ? "Escribe tu contraseña para entrar."
                : "Elige tu contraseña. Es lo único que falta."}
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold" htmlFor="password">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete={tieneCuenta ? "current-password" : "new-password"}
                  autoFocus
                  className={input}
                />
              </div>
              {/* Repetir solo tiene sentido al ELEGIR una contraseña nueva.
                  Pedírselo a quien entra sería hacerle escribir dos veces algo
                  que ya sabe. */}
              {tieneCuenta ? null : (
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold" htmlFor="password2">
                    Repite la contraseña
                  </label>
                  <input
                    id="password2"
                    name="password2"
                    type="password"
                    required
                    autoComplete="new-password"
                    className={input}
                  />
                </div>
              )}
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-[11px] border border-[#f0c7bd] bg-[#FDF1EE] px-4 py-3 text-[13px] text-[#8a3520]"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={enviando}
              className="bg-kora-gradient mt-6 min-h-13 w-full rounded-full px-7 text-[16px] font-bold text-white disabled:opacity-60"
            >
              {enviando
                ? tieneCuenta
                  ? "Entrando…"
                  : "Creando tu cuenta…"
                : tieneCuenta
                  ? "Entrar y continuar"
                  : "Crear cuenta y continuar"}
            </button>

            <button
              type="button"
              onClick={onContinuar}
              className="mt-4 w-full text-[14px] text-muted-foreground underline underline-offset-2"
            >
              {tieneCuenta ? "No, en otro momento" : "En otro momento"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
