import Link from "next/link";
import type { Currency } from "@/modules/pricing";

/**
 * Selector de moneda de una pantalla del panel.
 *
 * Vive en la DIRECCIÓN, como el resto de filtros del panel: es enlazable y
 * sobrevive a recargar. Y es propio del panel — no la moneda de la tienda, que
 * es del comprador.
 *
 * Que la moneda esté siempre visible no es decoración: estas cifras se leen de
 * un vistazo y sin ella no hay forma de saber si "$40" son pesos o dólares.
 */
export function CurrencyTabs({
  current,
  hrefFor,
}: {
  current: Currency;
  hrefFor: (c: Currency) => string;
}) {
  const monedas: Currency[] = ["COP", "USD"];
  return (
    <div className="inline-flex rounded-[10px] border border-[#e2ddd6] bg-white p-0.5">
      {monedas.map((c) => {
        const activa = c === current;
        return (
          <Link
            key={c}
            href={hrefFor(c)}
            aria-current={activa ? "true" : undefined}
            className={
              activa
                ? "bg-kora-gradient rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold text-white"
                : "rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#6b6f78] hover:text-kora-black"
            }
          >
            {c}
          </Link>
        );
      })}
    </div>
  );
}
