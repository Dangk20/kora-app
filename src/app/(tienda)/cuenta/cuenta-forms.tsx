"use client";

import { useActionState, useEffect, useState } from "react";
import { LogOut, Pencil } from "lucide-react";
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

/**
 * Tarjeta de "Mis datos": se LEE, y solo se edita al pedirlo.
 *
 * Antes los campos estaban siempre abiertos y editables. Una pantalla así
 * invita a tocar lo que no se venía a tocar —y aquí lo que se toca es la
 * dirección a la que llega un pedido y el número por el que le escriben—; al
 * mismo tiempo, no deja LEER los datos de un vistazo, que es a lo que se
 * entra el 90 % de las veces. Patrón de tienda conocido: leer por omisión,
 * editar a propósito.
 */
function Tarjeta({
  titulo,
  accion,
  editando,
  onAlternar,
  children,
}: {
  titulo: string;
  /** "Editar" o "Cambiar": lo que se va a hacer, no lo que se está viendo. */
  accion: string;
  editando: boolean;
  onAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15.5px] font-extrabold text-kora-black">{titulo}</h2>
        <button
          type="button"
          onClick={onAlternar}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-kora-coral transition-colors hover:bg-[#FFF4EF]"
        >
          {editando ? (
            "Cancelar"
          ) : (
            <>
              <Pencil className="size-[14px]" aria-hidden /> {accion}
            </>
          )}
        </button>
      </header>
      {children}
    </section>
  );
}

/** Una línea de la vista de lectura. */
function Fila({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div className="border-b border-[#f3efe9] py-3 last:border-0">
      <p className="text-[12px] text-[#8a8f98]">{label}</p>
      <p
        className={
          valor
            ? "mt-0.5 text-[14px] text-kora-black"
            : "mt-0.5 text-[14px] text-[#b3b8c0] italic"
        }
      >
        {valor || "Sin registrar"}
      </p>
    </div>
  );
}

export function DatosForm({
  defaults,
}: {
  defaults: {
    name: string;
    phone: string;
    /** Solo para leerlo: es la credencial de acceso, no se edita desde aquí. */
    email?: string;
  };
}) {
  const [state, action] = useActionState(actualizarDatos, null);
  const [editando, setEditando] = useState(false);

  // Guardado con éxito: la tarjeta vuelve a leerse sola. La acción revalida
  // /cuenta, así que los valores que se leen ya son los nuevos.
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (!editando) {
    return (
      <Tarjeta
        titulo="Mi información"
        accion="Editar"
        editando={false}
        onAlternar={() => setEditando(true)}
      >
        <Fila label="Nombre completo" valor={defaults.name} />
        {/* El correo se enseña porque es CON LO QUE SE ENTRA, y no se edita
            aquí: cambiarlo es cambiar la credencial de acceso. */}
        <Fila label="Correo (con este entras)" valor={defaults.email} />
        <Fila label="WhatsApp" valor={defaults.phone} />
        {/* Ciudad y dirección viven en "Mis direcciones" desde el 1 sep 2026.
            Dejar aquí una dirección suelta mientras existe la libreta serían
            dos respuestas distintas a la misma pregunta. */}
        {state?.ok && (
          <p className="pt-3 text-[12.5px] text-[#2c6b34]">Datos actualizados.</p>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo="Mi información"
      accion="Editar"
      editando
      onAlternar={() => setEditando(false)}
    >
      <form action={action} className="grid gap-3">
        <Campo id="name" label="Nombre completo" defaultValue={defaults.name} autoComplete="name" />
        <Campo id="phone" label="WhatsApp" defaultValue={defaults.phone} autoComplete="tel" />
        <Aviso state={state} exito="Datos actualizados." />
        <Guardar />
        <p className="text-[11.5px] text-muted-foreground">
          Tus pedidos anteriores conservan los datos con los que se hicieron.
        </p>
      </form>
    </Tarjeta>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(cambiarPassword, null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (!editando) {
    return (
      <Tarjeta
        titulo="Contraseña"
        accion="Cambiar"
        editando={false}
        onAlternar={() => setEditando(true)}
      >
        <Fila label="Contraseña" valor="••••••••" />
        {state?.ok && (
          <p className="pt-3 text-[12.5px] text-[#2c6b34]">
            Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos.
          </p>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Contraseña" accion="Cambiar" editando onAlternar={() => setEditando(false)}>
      <form action={action} className="grid gap-3">
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
    </Tarjeta>
  );
}

export function SalirButton({ compacto = false }: { compacto?: boolean }) {
  // En móvil va dentro de la franja oscura del usuario y es solo el icono,
  // como el diseño (§07): ahí el ancho lo necesitan el nombre y el correo.
  if (compacto) {
    return (
      <form action={salir}>
        <button
          type="submit"
          aria-label="Cerrar sesión"
          className="flex size-[30px] items-center justify-center text-[#A0A4AD] hover:text-white"
        >
          <LogOut className="size-[18px]" />
        </button>
      </form>
    );
  }

  return (
    <form action={salir}>
      <Button type="submit" variant="outline" size="sm">
        Cerrar sesión
      </Button>
    </form>
  );
}
