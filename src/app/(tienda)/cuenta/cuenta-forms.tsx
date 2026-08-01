"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD } from "@/modules/buyer/password";
import { actualizarDatos, cambiarPassword, salir, type FormState } from "./actions";

function Guardar({ texto = "Guardar" }: { texto?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" className="mt-1 w-full" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </Button>
  );
}

function Aviso({ state, exito }: { state: FormState; exito: string }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-[12.5px] text-[#8a2020]">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return <p className="text-[12.5px] text-[#2c6b34]">{exito}</p>;
  }
  return null;
}

function Campo({
  id,
  label,
  defaultValue,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[12.5px]">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="h-10 rounded-xl"
      />
    </div>
  );
}

export function DatosForm({
  defaults,
}: {
  defaults: { name: string; phone: string; city: string; address: string };
}) {
  const [state, action] = useActionState(actualizarDatos, null);

  return (
    <form action={action} className="grid gap-3 rounded-[14px] border border-[#eee9e2] p-5">
      <Campo id="name" label="Nombre completo" defaultValue={defaults.name} autoComplete="name" />
      <Campo id="phone" label="WhatsApp" defaultValue={defaults.phone} autoComplete="tel" />
      <Campo id="city" label="Ciudad" defaultValue={defaults.city} autoComplete="address-level2" />
      <Campo
        id="address"
        label="Dirección"
        defaultValue={defaults.address}
        autoComplete="street-address"
      />
      <Aviso state={state} exito="Datos actualizados." />
      <Guardar />
      {/* Los pedidos ya hechos conservan su propio snapshot: cambiar los datos
          de la cuenta no reescribe una dirección ya despachada. */}
      <p className="text-[11.5px] text-muted-foreground">
        Tus pedidos anteriores conservan los datos con los que se hicieron.
      </p>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(cambiarPassword, null);

  return (
    <form action={action} className="grid gap-3 rounded-[14px] border border-[#eee9e2] p-5">
      <Campo
        id="actual"
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
      />
      <Campo id="nueva" label="Contraseña nueva" type="password" autoComplete="new-password" />
      <p className="text-[11.5px] text-muted-foreground">Mínimo {MIN_PASSWORD} caracteres.</p>
      <Aviso
        state={state}
        exito="Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos."
      />
      <Guardar texto="Cambiar contraseña" />
      <p className="text-[11.5px] text-muted-foreground">
        Al cambiarla se cierran tus sesiones en otros dispositivos.
      </p>
    </form>
  );
}

export function SalirButton() {
  return (
    <form action={salir}>
      <Button type="submit" variant="outline" size="sm">
        Cerrar sesión
      </Button>
    </form>
  );
}
