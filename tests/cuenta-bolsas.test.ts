// Qué bolsas de cashback ve el comprador.
import { describe, expect, it } from "vitest";
import { bolsasVisibles } from "@/app/(tienda)/cuenta/bolsas";

describe("bolsas de Kora Cashback visibles", () => {
  it("solo pesos: una sola tarjeta", () => {
    expect(bolsasVisibles({ cop: 24900, usd: 0 })).toEqual([{ moneda: "COP", valor: 24900 }]);
  });

  it("solo dólares: una sola tarjeta, y en dólares", () => {
    // No se cae a pesos: la bolsa que tiene es la de dólares.
    expect(bolsasVisibles({ cop: 0, usd: 12.5 })).toEqual([{ moneda: "USD", valor: 12.5 }]);
  });

  it("las dos: dos tarjetas, para deslizar", () => {
    expect(bolsasVisibles({ cop: 24900, usd: 12.5 })).toHaveLength(2);
  });

  it("ninguna: UNA tarjeta en cero, no dos", () => {
    // Enseñar "$0" y "$0.00" no informa el doble; solo ocupa el doble y
    // empuja los pedidos fuera de la pantalla.
    expect(bolsasVisibles({ cop: 0, usd: 0 })).toEqual([{ moneda: "COP", valor: 0 }]);
  });

  it("nunca suma ni convierte las dos monedas", () => {
    // No hay tasa de cambio en KORA. Un total combinado sería un número sin
    // significado que además parecería correcto.
    const b = bolsasVisibles({ cop: 100000, usd: 20 });
    expect(b.map((x) => x.valor)).toEqual([100000, 20]);
  });

  it("un saldo negativo no se muestra como si existiera", () => {
    // No debería ocurrir —el libro no lo permite— pero si ocurriera, enseñar
    // un saldo negativo al comprador es peor que no enseñarlo.
    expect(bolsasVisibles({ cop: -5, usd: 0 })).toEqual([{ moneda: "COP", valor: 0 }]);
  });
});
