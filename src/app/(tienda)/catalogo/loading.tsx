// Carga del catálogo. Next lo pinta mientras la página resuelve sus consultas.
//
// Reserva el mismo espacio que el listado real —cabecera, filtros y rejilla—
// para que al llegar los productos nada salte de sitio.
import { Hueso, RejillaEsqueleto } from "@/modules/storefront/skeleton";

export default function CargandoCatalogo() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 pb-12 sm:px-[22px] sm:pt-6 sm:pb-16">
      <Hueso className="mb-4 h-3 w-40" />
      <Hueso className="mb-2 h-7 w-56 sm:h-9 sm:w-72" />
      <Hueso className="mb-6 h-3 w-24" />

      {/* Chips de categoría (móvil) */}
      <div className="mb-4 flex gap-2 lg:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Hueso key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[262px_1fr]">
        <Hueso className="hidden h-[320px] rounded-[18px] lg:block" />
        <RejillaEsqueleto />
      </div>
    </div>
  );
}
