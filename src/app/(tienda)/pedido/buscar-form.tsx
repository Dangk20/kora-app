"use client";

import { useActionState } from "react";
import { buscarPedido, type BuscarResult } from "./actions";
import { useMessages } from "@/modules/i18n/provider";

const input =
  "w-full min-h-12 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-[15px] py-3 text-base sm:text-sm outline-none focus:border-kora-coral";
const label = "mb-1.5 block text-[13px] font-semibold";

export function BuscarPedidoForm() {
  const [estado, accion, pendiente] = useActionState<BuscarResult, FormData>(
    buscarPedido,
    undefined,
  );
  const ts = useMessages().pedido.seguimiento;

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className={label} htmlFor="numero">
          {ts.numero}
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
          {ts.contacto}
        </label>
        <input
          id="contacto"
          name="contacto"
          required
          autoComplete="off"
          placeholder={ts.placeholderContacto}
          className={input}
        />
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          {ts.contactoAyuda}
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
        {pendiente ? ts.buscando : ts.ver}
      </button>
    </form>
  );
}
