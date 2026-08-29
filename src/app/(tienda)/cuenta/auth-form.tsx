"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD } from "@/modules/buyer/password";
import type { FormState } from "./actions";

function Enviar({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? enviando : texto}
    </Button>
  );
}

function Password({
  id,
  name,
  label,
  autoComplete,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="h-11 rounded-xl pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {/* El mínimo se dice ANTES de enviar, no después de que lo rechacen. */}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Error({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-[#f3c7c7] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]"
    >
      {mensaje}
    </p>
  );
}

export function EntrarForm({
  action,
  volver,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  volver?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-5">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <Error mensaje={state?.error} />

      <div className="grid gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 rounded-xl"
        />
      </div>

      <Password id="password" name="password" label="Contraseña" autoComplete="current-password" />

      <Enviar texto="Entrar" enviando="Entrando…" />

      {/* El enlace vuelve el 28 ago 2026, cuando el dominio pudo enviar correo.
          Antes decía "escríbenos por WhatsApp y te ayudamos": un apaño que
          obligaba a que alguien del negocio cambiara la contraseña de otra
          persona, que es justo lo que un sistema de cuentas debe evitar. */}
      <p className="text-center text-[12.5px]">
        <Link href="/cuenta/recuperar" className="text-muted-foreground underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-center text-[13px]">
        ¿No tienes cuenta?{" "}
        <Link href="/cuenta/crear" className="font-semibold text-kora-black underline">
          Créala aquí
        </Link>
      </p>
    </form>
  );
}

export function CrearForm({
  action,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-5">
      <Error mensaje={state?.error} />

      <div className="grid gap-2">
        <Label htmlFor="name">Nombre completo</Label>
        <Input id="name" name="name" autoComplete="name" required className="h-11 rounded-xl" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 rounded-xl"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">WhatsApp (opcional)</Label>
        <Input id="phone" name="phone" autoComplete="tel" className="h-11 rounded-xl" />
        <p className="text-[12px] text-muted-foreground">
          Es por donde confirmamos los pedidos.
        </p>
      </div>

      <Password
        id="password"
        name="password"
        label="Contraseña"
        autoComplete="new-password"
        hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
      />

      <Enviar texto="Crear cuenta" enviando="Creando…" />

      <p className="text-center text-[13px]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/cuenta/entrar" className="font-semibold text-kora-black underline">
          Entra aquí
        </Link>
      </p>
    </form>
  );
}
