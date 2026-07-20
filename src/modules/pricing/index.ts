// RESOLUCIÓN DE PRECIO — la única fuente de verdad del sistema (CAT_HU001 §3).
//
// La UI nunca calcula precios por su cuenta: pide `resolvePrice()` y muestra
// lo que devuelve. La misma función alimenta tienda, carrito, checkout y el
// snapshot del pedido; el POS siempre usa precio de tienda en COP.
//
// Reglas que implementa:
//   - Cada divisa tiene su precio CARGADO. Nunca se convierte por tasa (TIE_HU001).
//   - El canal web usa el precio online; el canal tienda/POS el de tienda.
//   - El "precio especial online" solo se comunica como tal si es MENOR que el
//     de tienda en la misma moneda. Si es mayor o igual, se muestra solo el
//     precio online, sin tachado ni badge: nunca un descuento falso (TIE_HU002 §2).

export type Currency = "COP" | "USD";
export type Channel = "online" | "store";

export const CURRENCIES: Currency[] = ["COP", "USD"];
export const DEFAULT_CURRENCY: Currency = "COP";

/** Los 4 precios de una variante, tal como viven en la base. */
export type VariantPrices = {
  priceCopStore: number;
  priceCopOnline: number;
  priceUsdStore: number;
  priceUsdOnline: number;
};

export type ResolvedPrice = {
  /** Lo que el visitante paga. */
  amount: number;
  currency: Currency;
  /** Precio de tienda en la MISMA moneda; se tacha solo si hay ahorro real. */
  storeAmount: number;
  /** true → mostrar tachado + badge "Precio especial online". */
  hasOnlineDiscount: boolean;
  /** false → no comprable en esta moneda (precio no cargado). */
  available: boolean;
};

/** Acepta Decimal de Prisma, string o number sin perder precisión visible. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return Number.NaN;
}

export function resolvePrice(
  prices: VariantPrices,
  currency: Currency,
  channel: Channel = "online",
): ResolvedPrice {
  const store = currency === "COP" ? prices.priceCopStore : prices.priceUsdStore;
  const online = currency === "COP" ? prices.priceCopOnline : prices.priceUsdOnline;

  const amount = channel === "online" ? online : store;
  // Un precio en 0 o inválido significa "no cargado en esta divisa": el
  // producto no es comprable en ella (TIE_HU002, criterios no funcionales).
  const available = Number.isFinite(amount) && amount > 0;

  return {
    amount,
    currency,
    storeAmount: store,
    hasOnlineDiscount:
      channel === "online" &&
      available &&
      Number.isFinite(store) &&
      store > amount,
    available,
  };
}

/** COP `$1.234.567` (sin decimales) · USD `$1,234.56` (2 decimales). */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "COP") {
    return `$${Math.round(amount).toLocaleString("es-CO")}`;
  }
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Rango de precios de un producto con varias variantes: "$X" o "$X – $Y". */
export function formatPriceRange(amounts: number[], currency: Currency): string {
  const valid = amounts.filter((a) => Number.isFinite(a) && a > 0);
  if (valid.length === 0) return "—";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return min === max
    ? formatMoney(min, currency)
    : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

export function isCurrency(value: unknown): value is Currency {
  return value === "COP" || value === "USD";
}

/**
 * Moneda por país (TIE_HU001 §1): Colombia → COP, resto → USD.
 * Sin país (geolocalización no disponible o fallida) → COP.
 */
export function currencyForCountry(countryCode: string | null | undefined): Currency {
  if (!countryCode) return DEFAULT_CURRENCY;
  return countryCode.toUpperCase() === "CO" ? "COP" : "USD";
}
