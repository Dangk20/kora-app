// Las tres garantías bajo los botones de compra de la ficha (prototipo §3).

import { GUARANTEES } from "./guarantees";
import { useMessages } from "@/modules/i18n/provider";

/**
 * Más pequeñas que en el home: aquí compiten con el precio y los botones, que
 * es lo que el comprador vino a mirar.
 */
export function ProductGuarantees() {
  // Se pinta dentro de la ficha, que es componente cliente: el idioma sale
  // del proveedor. El ícono, de la lista; el texto, del idioma (mismo orden).
  const garantias = useMessages().tienda.garantias;
  return (
    <ul className="mt-5 grid gap-3 border-t border-[#f0ece6] pt-5 sm:grid-cols-3">
      {GUARANTEES.map(({ icon: Icon }, i) => {
        const { title, text } = garantias[i];
        return (
        <li key={title} className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FFE9DD] text-kora-coral">
            <Icon className="size-[17px]" aria-hidden />
          </span>
          <div>
            <p className="text-[12.5px] leading-tight font-semibold text-kora-black">{title}</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.35] text-[#8a8f98]">{text}</p>
          </div>
        </li>
        );
      })}
    </ul>
  );
}
