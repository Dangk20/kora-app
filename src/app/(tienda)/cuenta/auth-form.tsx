"use client";

import { useActionState } from "react";
import { PasswordField } from "./password-field";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD } from "@/modules/buyer/password";
import type { FormState } from "./actions";
import { useMessages } from "@/modules/i18n/provider";

function Enviar({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? enviando : texto}
    </Button>
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
  const t = useMessages().cuenta;

  return (
    <form action={formAction} className="grid gap-5">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <Error mensaje={state?.error} />

      <div className="grid gap-2">
        <Label htmlFor="email">{t.correo}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 rounded-xl"
        />
      </div>

      <PasswordField id="password" name="password" label={t.contrasena} autoComplete="current-password" />

      <Enviar texto={t.entrar.boton} enviando={t.entrar.enviando} />

      {/* El enlace vuelve el 28 ago 2026, cuando el dominio pudo enviar correo.
          Antes decía "escríbenos por WhatsApp y te ayudamos": un apaño que
          obligaba a que alguien del negocio cambiara la contraseña de otra
          persona, que es justo lo que un sistema de cuentas debe evitar. */}
      <p className="text-center text-[12.5px]">
        <Link href="/cuenta/recuperar" className="text-muted-foreground underline">
          {t.entrar.olvidaste}
        </Link>
      </p>
      <p className="text-center text-[13px]">
        {t.entrar.sinCuenta}{" "}
        <Link href="/cuenta/crear" className="font-semibold text-kora-black underline">
          {t.entrar.creala}
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
  const t = useMessages().cuenta;

  return (
    <form action={formAction} className="grid gap-5">
      <Error mensaje={state?.error} />

      <div className="grid gap-2">
        <Label htmlFor="name">{t.crear.nombre}</Label>
        <Input id="name" name="name" autoComplete="name" required className="h-11 rounded-xl" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">{t.correo}</Label>
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
        <Label htmlFor="phone">{t.crear.whatsappOpcional}</Label>
        <Input id="phone" name="phone" autoComplete="tel" className="h-11 rounded-xl" />
        <p className="text-[12px] text-muted-foreground">
          {t.crear.whatsappAyuda}
        </p>
      </div>

      <PasswordField
        id="password"
        name="password"
        label={t.contrasena}
        autoComplete="new-password"
        hint={t.minimoCaracteres(MIN_PASSWORD)}
      />

      <Enviar texto={t.crear.boton} enviando={t.crear.enviando} />

      <p className="text-center text-[13px]">
        {t.crear.yaTienes}{" "}
        <Link href="/cuenta/entrar" className="font-semibold text-kora-black underline">
          {t.crear.entraAqui}
        </Link>
      </p>
    </form>
  );
}
