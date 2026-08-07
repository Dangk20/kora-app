// Esqueletos de carga de la tienda.
//
// Un esqueleto no es decoración: reserva EL MISMO espacio que va a ocupar el
// contenido real. Si no lo hace, al llegar los datos la página salta y el dedo
// que iba a un producto acaba en otro — el defecto que Google mide como
// desplazamiento acumulado y que en un teléfono se siente como que la tienda
// va a trompicones.
//
// Por eso las medidas de aquí copian las de `ProductCard` y las de la ficha:
// si una cambia, la otra tiene que cambiar.

/** Bloque gris con brillo. `aria-hidden`: no hay nada que leer todavía. */
export function Hueso({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-[10px] bg-[#ece7e0] ${className}`}
    />
  );
}

/** Tarjeta de producto en carga: mismas proporciones que la real. */
export function TarjetaEsqueleto() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#efe9e1] bg-white">
      {/* Cuadrada, como el contenedor de foto real. */}
      <Hueso className="aspect-square rounded-none" />
      <div className="px-3.5 pt-3 pb-4">
        <Hueso className="mb-2 h-2.5 w-1/3" />
        <Hueso className="mb-1.5 h-3.5 w-full" />
        <Hueso className="mb-3 h-3.5 w-2/3" />
        <Hueso className="h-5 w-1/2" />
      </div>
    </div>
  );
}

/** Rejilla de carga del catálogo. */
export function RejillaEsqueleto({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
      role="status"
      aria-label="Cargando productos"
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <TarjetaEsqueleto key={i} />
      ))}
    </div>
  );
}
