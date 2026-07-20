// Resolución y presentación del precio (CAT_HU001 §3, TIE_HU001, TIE_HU002).
// La regla que más importa: nunca comunicar un descuento que no existe.
import { describe, expect, it } from "vitest";
import {
  currencyForCountry,
  formatMoney,
  formatPriceRange,
  resolvePrice,
  toNumber,
  type VariantPrices,
} from "@/modules/pricing";

const prices: VariantPrices = {
  priceCopStore: 100000,
  priceCopOnline: 89000,
  priceUsdStore: 30,
  priceUsdOnline: 26.5,
};

describe("resolución del precio vigente", () => {
  it("el canal online usa el precio online de la moneda activa", () => {
    expect(resolvePrice(prices, "COP").amount).toBe(89000);
    expect(resolvePrice(prices, "USD").amount).toBe(26.5);
  });

  it("el canal tienda (POS) usa el precio de tienda", () => {
    expect(resolvePrice(prices, "COP", "store").amount).toBe(100000);
    expect(resolvePrice(prices, "COP", "store").hasOnlineDiscount).toBe(false);
  });

  it("marca el precio especial online cuando hay ahorro real", () => {
    const cop = resolvePrice(prices, "COP");
    expect(cop.hasOnlineDiscount).toBe(true);
    expect(cop.storeAmount).toBe(100000); // el tachado usa la MISMA moneda
    expect(resolvePrice(prices, "USD").storeAmount).toBe(30);
  });

  it("NO marca descuento si el precio online es mayor o igual al de tienda", () => {
    // Caso permitido con advertencia en CAT_HU001: no puede leerse como oferta.
    const iguales = resolvePrice(
      { ...prices, priceCopOnline: 100000 },
      "COP",
    );
    expect(iguales.hasOnlineDiscount).toBe(false);
    expect(iguales.amount).toBe(100000);

    const masCaro = resolvePrice({ ...prices, priceCopOnline: 120000 }, "COP");
    expect(masCaro.hasOnlineDiscount).toBe(false);
  });

  it("un precio no cargado en una divisa deja el producto no comprable en ella", () => {
    const sinUsd = resolvePrice({ ...prices, priceUsdOnline: 0 }, "USD");
    expect(sinUsd.available).toBe(false);
    expect(resolvePrice(prices, "USD").available).toBe(true);
  });

  it("nunca convierte por tasa: cada divisa usa su propio precio cargado", () => {
    // 89000 COP no se transforma en USD; USD trae su propio valor.
    expect(resolvePrice(prices, "USD").amount).toBe(26.5);
    expect(resolvePrice(prices, "USD").amount).not.toBeCloseTo(89000 / 4100, 1);
  });
});

describe("formato de moneda", () => {
  it("COP sin decimales con separador de miles", () => {
    expect(formatMoney(1234567, "COP")).toBe("$1.234.567");
    expect(formatMoney(89000, "COP")).toBe("$89.000");
    expect(formatMoney(89000.6, "COP")).toBe("$89.001"); // redondea, no trunca
  });

  it("USD con dos decimales", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(26.5, "USD")).toBe("$26.50");
  });

  it("rango de precios de un producto con varias variantes", () => {
    expect(formatPriceRange([89000, 120000], "COP")).toBe("$89.000 – $120.000");
    expect(formatPriceRange([89000, 89000], "COP")).toBe("$89.000");
    expect(formatPriceRange([0, 0], "COP")).toBe("—");
  });
});

describe("moneda por país", () => {
  it("Colombia usa COP y el resto del mundo USD", () => {
    expect(currencyForCountry("CO")).toBe("COP");
    expect(currencyForCountry("co")).toBe("COP");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("ES")).toBe("USD");
  });

  it("sin país detectado cae a COP, el mercado principal", () => {
    expect(currencyForCountry(null)).toBe("COP");
    expect(currencyForCountry("")).toBe("COP");
  });
});

describe("lectura de los Decimal de Prisma", () => {
  it("convierte Decimal, string y number sin perder el valor", () => {
    expect(toNumber(89000)).toBe(89000);
    expect(toNumber("89000.50")).toBe(89000.5);
    expect(toNumber({ toString: () => "26.50" })).toBe(26.5);
  });
});
