// Presentación del precio en la tienda (TIE_HU002).
//
// Nunca calcula: recibe lo que resolvió `resolvePrice()`. El tachado y el
// badge SOLO aparecen cuando hay ahorro real frente al precio de tienda en la
// misma moneda — si el precio online es mayor o igual, se muestra solo el
// precio online, sin señales de descuento.
import { Flame } from "lucide-react";
import { formatMoney, type ResolvedPrice } from "@/modules/pricing";

export function PriceTag({
  price,
  size = "card",
}: {
  price: ResolvedPrice;
  size?: "card" | "detail";
}) {
  if (!price.available) {
    return (
      <p className="text-[13px] font-semibold text-[#8a8f98]">
        No disponible en {price.currency}
      </p>
    );
  }

  const isDetail = size === "detail";

  return (
    <div className={isDetail ? "space-y-2" : ""}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={
            isDetail
              ? "text-[34px] leading-none font-extrabold text-kora-black"
              : "text-[19px] leading-none font-bold text-kora-black"
          }
        >
          {formatMoney(price.amount, price.currency)}
        </span>
        {price.hasOnlineDiscount && (
          <span
            className={`text-[#b3b8c0] line-through ${isDetail ? "text-base" : "text-xs"}`}
          >
            {formatMoney(price.storeAmount, price.currency)}
          </span>
        )}
      </div>

      {/* El badge completo vive en la ficha; en las cards basta el tachado. */}
      {price.hasOnlineDiscount && isDetail && (
        <span className="bg-kora-gradient inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-white">
          <Flame className="size-3.5" /> Precio especial online
        </span>
      )}
    </div>
  );
}
