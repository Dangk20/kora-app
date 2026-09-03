"use client";

// Campo de dinero con separadores de miles.
//
// POR QUÉ NO ES UN `type="number"`: los campos numéricos del navegador NO
// pueden mostrar separadores. `70000` y `700000` se distinguen contando ceros
// de uno en uno, y ese es el error que nadie detecta hasta que un producto
// sale publicado a diez veces su precio.
//
// Cada divisa se escribe como se escribe en su sitio, igual que `formatMoney`:
//   COP  70.000     (punto de miles, sin decimales)
//   USD  1,234.56   (coma de miles, punto decimal)
//
// El valor que sale hacia el formulario es SIEMPRE crudo —"70000"—: lo que se
// guarda es un número, y dejar que viaje formateado obligaría a limpiarlo en
// cada sitio que lo recibe.

import type { Currency } from "@/modules/pricing";

/** Lo que el operador escribió, en crudo, listo para guardar. */
function aCrudo(texto: string, moneda: Currency): string {
  if (moneda === "COP") return texto.replace(/\D/g, "");
  // USD admite decimales: se conserva un solo punto y como mucho dos cifras.
  const limpio = texto.replace(/[^\d.]/g, "");
  const [entero, ...resto] = limpio.split(".");
  return resto.length ? `${entero}.${resto.join("").slice(0, 2)}` : entero;
}

/** Lo que se ve mientras se escribe. */
function aVisible(crudo: string, moneda: Currency): string {
  if (!crudo) return "";
  if (moneda === "COP") {
    return Number(crudo).toLocaleString("es-CO");
  }
  const [entero, decimales] = crudo.split(".");
  const conMiles = entero ? Number(entero).toLocaleString("en-US") : "";
  // El punto se conserva mientras se teclea: sin esto, escribir "50." lo
  // borraría en el mismo momento y no se podrían poner decimales.
  return crudo.includes(".") ? `${conMiles}.${decimales ?? ""}` : conMiles;
}

export function MoneyInput({
  moneda,
  value,
  onChange,
  placeholder,
  className,
  required = false,
  id,
}: {
  moneda: Currency;
  /** Valor crudo: "70000", "49.99". */
  value: string;
  onChange: (crudo: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-[#b3b8c0]">
        {moneda === "COP" ? "$" : "US$"}
      </span>
      <input
        id={id}
        // `inputMode` para que el móvil abra el teclado numérico; `type=text`
        // porque un `number` no admite puntos de miles.
        type="text"
        inputMode="decimal"
        value={aVisible(value, moneda)}
        onChange={(e) => onChange(aCrudo(e.target.value, moneda))}
        placeholder={placeholder}
        required={required}
        className={`${className ?? ""} ${moneda === "COP" ? "pl-7" : "pl-10"} text-right tabular-nums`}
      />
    </div>
  );
}
