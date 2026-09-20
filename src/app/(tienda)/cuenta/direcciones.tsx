"use client";

// "Mis direcciones": la libreta del comprador.
//
// Mismo patrón que "Mi información": se LEE, y se edita a propósito. Aquí
// además importa porque una dirección equivocada no se corrige con un
// mensaje: se corrige cuando el pedido llegó a otro sitio.

import { useActionState, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectorDivisionCiudad } from "../_components/selector-ciudad";
import type { Address } from "@/modules/customers/addresses";
import {
  eliminarDireccion,
  guardarDireccion,
  marcarPredeterminada,
} from "./direcciones-actions";

/** Una línea legible: "CL 22 A # 43 - 61, apto 1103 · Barrio Orquídea". */
function resumen(d: Address): string {
  return [d.address, d.address2, d.neighborhood].filter(Boolean).join(", ");
}

function lugar(d: Address): string {
  return [d.city, d.state, d.country === "US" ? d.zip : null].filter(Boolean).join(", ");
}

function Enviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" className="w-full" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </Button>
  );
}

function Campo({
  id,
  label,
  defaultValue,
  requerido = false,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  requerido?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[12.5px]">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        required={requerido}
        className="h-10 rounded-xl"
      />
    </div>
  );
}

function Formulario({
  direccion,
  esPrimera,
  onCerrar,
}: {
  direccion?: Address;
  /** La primera dirección queda predeterminada sola: no se pregunta. */
  esPrimera: boolean;
  onCerrar: () => void;
}) {
  const [state, action] = useActionState(guardarDireccion, null);
  // Siempre Colombia: la libreta es de envío y KORA no envía a EE.UU. Una
  // dirección guardada allá antes del 20 sep 2026 se edita como colombiana.
  const [division, setDivision] = useState(direccion?.country === "CO" ? (direccion?.state ?? "") : "");
  const [ciudad, setCiudad] = useState(direccion?.country === "CO" ? (direccion?.city ?? "") : "");

  useEffect(() => {
    if (state?.ok) onCerrar();
    // `onCerrar` cambia en cada render del padre; solo interesa el resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-3">
      {direccion && <input type="hidden" name="id" value={direccion.id} />}

      <input type="hidden" name="country" value="CO" />
      <p className="text-[12.5px] text-[#6b6f78]">Hacemos envíos dentro de Colombia.</p>

      <Campo id="label" label="Nombre para reconocerla (Casa, Oficina…)" defaultValue={direccion?.label} />

      {/* El MISMO selector encadenado del checkout: departamento/estado →
          ciudad. Elegir una dirección allá y crearla aquí es la misma
          experiencia. */}
      <SelectorDivisionCiudad
        country="CO"
        state={division}
        onState={setDivision}
        city={ciudad}
        onCity={setCiudad}
        inputCls="h-10 w-full rounded-xl border-[1.6px] border-[#e2ddd6] px-3 text-[14px] text-kora-black outline-none focus:border-kora-coral"
        labelCls="mb-1.5 block text-[12.5px] font-medium"
      />

      <Campo id="address" label="Dirección" defaultValue={direccion?.address} requerido />
      <Campo id="address2" label="Apartamento, torre, conjunto (opcional)" defaultValue={direccion?.address2} />

      <Campo id="neighborhood" label="Barrio" defaultValue={direccion?.neighborhood} requerido />

      <Campo id="notes" label="Indicaciones de entrega (opcional)" defaultValue={direccion?.notes} />

      {!esPrimera && (
        <label className="flex items-center gap-2 text-[13px] text-[#4a4f58]">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={direccion?.isDefault ?? false}
            className="size-4 accent-kora-coral"
          />
          Usar como dirección predeterminada
        </label>
      )}

      {state?.error && (
        <p role="alert" className="text-[12.5px] text-[#8a2020]">
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Enviar texto={direccion ? "Guardar cambios" : "Guardar dirección"} />
        <button
          type="button"
          onClick={onCerrar}
          className="text-[13px] font-semibold text-[#8a8f98] hover:text-kora-black"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ConfirmarBorrado({ direccion }: { direccion: Address }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Eliminar la dirección ${direccion.label ?? resumen(direccion)}`}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#8a8f98] transition-colors hover:text-destructive"
      >
        <Trash2 className="size-[14px]" aria-hidden /> Eliminar
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent
          overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[380px] motion-reduce:duration-0"
        >
          <div className="px-6 pt-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[17px] font-bold text-kora-black">
                ¿Eliminar esta dirección?
              </DialogTitle>
              <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
                <span className="font-semibold text-kora-black">{resumen(direccion)}</span> saldrá
                de tu libreta. Tus pedidos anteriores conservan la dirección con la que se
                hicieron.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Cancelar dominante, igual que al quitar del carrito: quien abre
              esta ventana por accidente tiene delante lo que no rompe nada. */}
          <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
            >
              Cancelar
            </button>
            <form action={eliminarDireccion}>
              <input type="hidden" name="id" value={direccion.id} />
              <button
                type="submit"
                className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                Sí, eliminarla
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Tarjeta({ direccion }: { direccion: Address }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6">
        <h3 className="mb-4 text-[15.5px] font-extrabold text-kora-black">Editar dirección</h3>
        <Formulario direccion={direccion} esPrimera={false} onCerrar={() => setEditando(false)} />
      </section>
    );
  }

  return (
    <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <MapPin className="mt-0.5 size-[18px] shrink-0 text-kora-coral" aria-hidden />
          <div className="min-w-0">
            {direccion.label && (
              <p className="text-[12px] font-semibold tracking-[0.3px] text-[#8a8f98] uppercase">
                {direccion.label}
              </p>
            )}
            <p className="mt-0.5 text-[14.5px] font-bold text-kora-black">{resumen(direccion)}</p>
            <p className="mt-0.5 text-[13px] text-[#6b6f78]">{lugar(direccion)}</p>
            {direccion.notes && (
              <p className="mt-1 text-[12.5px] text-[#8a8f98]">{direccion.notes}</p>
            )}
            {direccion.isDefault ? (
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FFF4EF] px-2.5 py-1 text-[11.5px] font-bold text-kora-coral">
                <Star className="size-[12px] fill-current" aria-hidden /> Predeterminada
              </span>
            ) : (
              <form action={marcarPredeterminada} className="mt-2.5">
                <input type="hidden" name="id" value={direccion.id} />
                <button
                  type="submit"
                  className="text-[12px] font-semibold text-[#8a8f98] underline underline-offset-2 hover:text-kora-black"
                >
                  Usar como predeterminada
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-kora-coral"
          >
            <Pencil className="size-[14px]" aria-hidden /> Editar
          </button>
          <ConfirmarBorrado direccion={direccion} />
        </div>
      </div>
    </section>
  );
}

export function Direcciones({ direcciones }: { direcciones: Address[] }) {
  const [agregando, setAgregando] = useState(false);

  return (
    <div className="space-y-4">
      {direcciones.map((d) => (
        <Tarjeta key={d.id} direccion={d} />
      ))}

      {direcciones.length === 0 && !agregando && (
        <section className="rounded-[18px] bg-white p-6 text-center shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
          <p className="text-[14px] text-[#6b6f78]">
            Todavía no tienes direcciones guardadas.
          </p>
          <p className="mt-1 text-[12.5px] text-[#8a8f98]">
            Guarda una y no tendrás que escribirla en cada compra.
          </p>
        </section>
      )}

      {agregando ? (
        <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6">
          <h3 className="mb-4 text-[15.5px] font-extrabold text-kora-black">Nueva dirección</h3>
          <Formulario
            esPrimera={direcciones.length === 0}
            onCerrar={() => setAgregando(false)}
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="bg-kora-gradient flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold text-white hover:opacity-90 sm:w-auto sm:px-7"
        >
          <Plus className="size-[18px]" aria-hidden /> Agregar una dirección
        </button>
      )}
    </div>
  );
}
