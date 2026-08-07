"use client";

// Barra lateral de la cuenta (prototipo §7): avatar con la inicial,
// nombre/email, pestañas y cerrar sesión.
//
// Las pestañas van por URL (`?seccion=…`) y no por estado local, como el resto
// de la aplicación: así se puede volver a "Mis datos" desde el historial, se
// puede enlazar directo, y recargar no te devuelve a la primera.
//
// En móvil la barra se convierte en cabecera + pestañas desplazables: un
// lateral de 240 px en un teléfono deja al contenido sin sitio.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Flame, Package, User } from "lucide-react";

export const SECCIONES = [
  { id: "pedidos", label: "Mis pedidos", icon: Package },
  { id: "cashback", label: "Kora Cashback", icon: Flame },
  { id: "datos", label: "Mis datos", icon: User },
] as const;

export type SeccionId = (typeof SECCIONES)[number]["id"];

export const SECCION_POR_DEFECTO: SeccionId = "pedidos";

/** Lee la sección de la URL, cayendo a la de por defecto si no se reconoce. */
export function seccionDe(valor: string | undefined): SeccionId {
  return SECCIONES.some((s) => s.id === valor) ? (valor as SeccionId) : SECCION_POR_DEFECTO;
}

export function CuentaSidebar({
  nombre,
  email,
  salir,
}: {
  nombre: string;
  email: string;
  salir: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activa = seccionDe(params.get("seccion") ?? undefined);

  return (
    <aside className="lg:w-[264px] lg:shrink-0">
      <div className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <span
            className="bg-kora-gradient flex size-12 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold text-white"
            aria-hidden
          >
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-kora-black">{nombre}</p>
            {email && <p className="truncate text-[12.5px] text-[#8a8f98]">{email}</p>}
          </div>
        </div>

        <nav
          aria-label="Secciones de la cuenta"
          // Fila desplazable en móvil, columna en escritorio.
          className="mt-5 -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {SECCIONES.map(({ id, label, icon: Icono }) => {
            const esActiva = id === activa;
            return (
              <Link
                key={id}
                href={`${pathname}?seccion=${id}`}
                scroll={false}
                aria-current={esActiva ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-[12px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                  esActiva
                    ? "bg-[#FFF4EF] text-kora-coral"
                    : "text-[#4a4f58] hover:bg-[#f7f4f0]"
                }`}
              >
                <Icono className="size-[17px]" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-[#f0ece6] pt-4">{salir}</div>
      </div>
    </aside>
  );
}
