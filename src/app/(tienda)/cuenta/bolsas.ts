// Qué bolsas de Kora Cashback se le enseñan al comprador.
//
// Regla del 7 ago: **solo la que tiene**. Mostrarle "$0.00 USD" a quien solo
// ha comprado en pesos es ruido con aspecto de dato — parece una cuenta que
// existe y está vacía, cuando lo que pasa es que nunca compró en esa moneda.
//
// Las dos NUNCA se suman ni se convierten: no hay tasa de cambio en KORA y es
// deliberado. Por eso, cuando tiene las dos, van en tarjetas separadas que se
// deslizan — nunca en un total.
//
// Vive aparte del componente porque es una regla de producto, y las reglas de
// producto se prueban.

export type Bolsa = { moneda: "COP" | "USD"; valor: number };

export function bolsasVisibles(disponible: { cop: number; usd: number }): Bolsa[] {
  const conSaldo: Bolsa[] = [
    { moneda: "COP", valor: disponible.cop },
    { moneda: "USD", valor: disponible.usd },
  ].filter((b): b is Bolsa => b.valor > 0);

  // Cuenta recién creada, sin saldo en ninguna: se enseña UNA en pesos, para
  // que el comprador sepa que el cashback existe antes de ganarlo. Dos ceros
  // no informarían el doble.
  return conSaldo.length > 0 ? conSaldo : [{ moneda: "COP", valor: 0 }];
}
