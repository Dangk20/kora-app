"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD } from "@/modules/buyer/password";
import { useMessages } from "@/modules/i18n/provider";
import type { FormState } from "../actions";
import { PasswordField } from "../password-field";

function Enviar({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? enviando : texto}
    </Button>
  );
}

export function NuevaClaveForm({ action }: { action: (prev: FormState, data: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, null);
  const t = useMessages().cuenta;
  return (
    <form action={formAction} className="grid gap-5">
      {state?.error && (
        <p role="alert" className="rounded-xl border border-[#f3c7c7] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
          {state.error}
        </p>
      )}
      <PasswordField
        id="nueva"
        name="nueva"
        label={t.nuevaClave.nueva}
        autoComplete="new-password"
        hint={t.minimoCaracteres(MIN_PASSWORD)}
      />
      <Enviar texto={t.nuevaClave.boton} enviando={t.nuevaClave.enviando} />
    </form>
  );
}
