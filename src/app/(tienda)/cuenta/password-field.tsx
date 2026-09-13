"use client";

// Campo de contraseña con el ojo para verla. UNA definición para entrar,
// crear cuenta, cambiarla y recuperarla: uno no sabe si la escribió bien
// hasta que se la rechazan (Daniel, 13 sep 2026), y la tienda no puede
// ofrecer el ojo en una pantalla y no en la de al lado.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({
  id,
  name = id,
  label,
  autoComplete,
  hint,
  required = true,
  minLength,
  inputClassName = "h-11 rounded-xl pr-11",
  labelClassName,
}: {
  id: string;
  name?: string;
  label: string;
  autoComplete: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-[#f5f3f0] hover:text-kora-black"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {/* El mínimo se dice ANTES de enviar, no después de que lo rechacen. */}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
