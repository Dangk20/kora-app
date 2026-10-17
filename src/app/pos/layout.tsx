import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { formatMoney } from "@/modules/pricing";
import { CAJA, turnoAbierto } from "@/modules/pos/turno";
import { MenuKora } from "./menu-kora";
import { AccionesTurno } from "./turno-ui";

// La caja (change s09-pos-caja): pantalla completa, sin el menú del panel.
// El middleware ya exige sesión en /pos; aquí se exige además poder verla.
//
// El encabezado concentra el turno: el estado de la caja va junto al nombre
// del cajero (una sola píldora, no dos) y las acciones del turno a la derecha.
// Panel y Tienda viven en el menú del logo.
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions?.includes("pos:view")) redirect("/admin");
  const turno = await turnoAbierto();
  const hora = (d: Date) =>
    new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(d);

  return (
    // Alto fijo de pantalla: la caja no hace scroll como página. Cada panel
    // (catálogo y ticket) tiene el suyo, y el botón de cobrar siempre se ve.
    <div className="bg-kora-beige flex h-dvh flex-col overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <header className="bg-kora-black flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-1.5 print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <MenuKora />
          <span className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] text-white/75">
            <span className={`size-2 shrink-0 rounded-full ${turno ? "bg-[#5fd08a]" : "bg-white/30"}`} />
            <span className="truncate">
              <b className="font-semibold text-white">{CAJA}</b>
              {turno
                ? ` · abierta por ${turno.openedByName} · desde ${hora(turno.openedAt)} · base ${formatMoney(turno.openingBase, "COP")}`
                : ` · cerrada · ${session.user.name}`}
            </span>
          </span>
        </div>
        {turno && (
          <AccionesTurno turno={{ id: turno.id, openedAt: turno.openedAt.toISOString(), openingBase: turno.openingBase, openedByName: turno.openedByName }} />
        )}
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden print:overflow-visible">{children}</main>
    </div>
  );
}
