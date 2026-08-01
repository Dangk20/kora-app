"use client";

// Alta y edición de cliente (CLI_HU003 / CLI_HU004).
// Los errores se muestran DENTRO del panel y conservan lo escrito: perder un
// formulario por un teléfono duplicado es la forma más rápida de que alguien
// deje de usar la pantalla.

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createCustomer, updateCustomer, type CustomerActionResult } from "@/modules/customers/actions";

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral";
const errorCls = "w-full rounded-[10px] border-[1.6px] border-destructive px-3.5 py-3 text-sm outline-none";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  country: string;
  city: string;
  address: string;
};

export function CustomerForm({
  customer,
  backTo,
}: {
  customer: Customer | null;
  backTo: string;
}) {
  const router = useRouter();
  const editando = customer !== null;

  const [state, formAction, pending] = useActionState<CustomerActionResult | null, FormData>(
    async (_prev, formData) => (editando ? updateCustomer(formData) : createCustomer(formData)),
    null,
  );

  const close = () => router.push(backTo);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      router.push(backTo);
    }
  }, [state, router, backTo]);

  const campoConError = state && !state.ok ? state.field : undefined;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(14,15,18,0.5)]" onClick={close}>
      <div
        className="flex h-full w-[440px] max-w-full flex-col overflow-y-auto bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0ece6] bg-white px-6 py-5">
          <h2 className="text-lg font-bold text-kora-black">
            {editando ? "Editar cliente" : "Crear cliente"}
          </h2>
          <button
            onClick={close}
            type="button"
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <form action={formAction} className="flex-1 space-y-3.5 px-6 py-5">
          {editando && <input type="hidden" name="id" value={customer.id} />}

          {state && !state.ok && (
            <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div>
            <label className={labelCls} htmlFor="name">
              Nombre completo
            </label>
            <input
              id="name"
              name="name"
              defaultValue={customer?.name}
              required
              className={campoConError === "name" ? errorCls : inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="country">
              País
            </label>
            <select
              id="country"
              name="country"
              defaultValue={customer?.country ?? "CO"}
              className={inputCls}
            >
              <option value="CO">Colombia (COP)</option>
              <option value="US">Estados Unidos (USD)</option>
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="phone">
              Número de WhatsApp
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={customer?.phone}
              required
              placeholder="320 827 0414"
              className={campoConError === "phone" ? errorCls : inputCls}
            />
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Es el identificador único del cliente. Da igual cómo lo escribas: se guarda
              siempre en formato internacional.
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="email">
              Email <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={customer?.email}
              className={campoConError === "email" ? errorCls : inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="document">
              Documento <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="document" name="document" defaultValue={customer?.document} className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="city">
              Ciudad <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="city" name="city" defaultValue={customer?.city} className={inputCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="address">
              Dirección <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="address" name="address" defaultValue={customer?.address} className={inputCls} />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-[10px] border-[1.6px] border-[#e2ddd6] py-3 text-sm font-semibold text-kora-black"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-kora-gradient flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
