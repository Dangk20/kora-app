"use client";

import { useActionState } from "react";
import { buscarPedido, type BuscarResult } from "./actions";

const input =
  "w-full min-h-12 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-[15px] py-3 text-base sm:text-sm outline-none focus:border-kora-coral";
const label = "mb-1.5 block text-[13px] font-semibold";

export function BuscarPedidoForm() {
  const [estado, accion, pendiente] = useActionState<BuscarResult, FormData>(
    buscarPedido,
    undefined,
  );

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className={label} htmlFor="numero">
          Número del pedido
        </label>
        <input
          id="numero"
          name="numero"
          required
          autoComplete="off"
          placeholder="KO-2026-00004"
          className={input}
        />
      </div>

      <div>
        <label className={label} htmlFor="contacto">
          Correo o celular con el que compraste
        </label>
        <input
          id="contacto"
          name="contacto"
          required
          autoComplete="off"
          placeholder="correo@ejemplo.com"
          className={input}
        />
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Pedimos este segundo dato para que nadie más pueda ver tu pedido.
        </p>
      </div>

      {estado?.error ? (
        <p
          role="alert"
          className="rounded-[11px] border border-[#f0c7bd] bg-[#FDF1EE] px-4 py-3 text-[13px] text-[#8a3520]"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-12 w-full rounded-full bg-kora-gradient px-6 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {pendiente ? "Buscando…" : "Ver mi pedido"}
      </button>
    </form>
  );
}
