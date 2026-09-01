// El selector de moneda del dashboard filtra TODO lo que se muestra.
//
// EL FALLO QUE ESTO IMPIDE (lo encontró Daniel probando, 1 sep 2026): con el
// panel en USD, "Pedidos pendientes" y "Últimos pedidos" seguían contando y
// listando pedidos en pesos. No es solo un filtro incompleto: dos tarjetas de
// la MISMA pantalla hablaban de universos distintos sin decirlo, y eso hace
// dudar del resto de las cifras — que son con las que se cierra un mes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagina = readFileSync("src/app/admin/page.tsx", "utf8");

describe("todas las consultas del dashboard respetan la moneda", () => {
  it("los pedidos pendientes se cuentan por moneda", () => {
    expect(pagina).toMatch(/db\.order\.count\(\{\s*where:\s*\{\s*status:\s*"PENDING",\s*currency\s*\}/);
  });

  it("los últimos pedidos se listan por moneda", () => {
    const consulta = pagina.slice(
      pagina.indexOf("db.order.findMany({"),
      pagina.indexOf("topProductsQuery("),
    );
    expect(consulta).toContain("where: { currency }");
  });

  it("ninguna consulta de pedidos queda sin filtrar", () => {
    // Cualquier `db.order.` del dashboard tiene que nombrar la moneda: es la
    // forma de que añadir una consulta nueva no reintroduzca el fallo.
    const consultas = pagina.match(/db\.order\.\w+\(\{[\s\S]*?\n {6}\}\)/g) ?? [];
    expect(consultas.length).toBeGreaterThanOrEqual(4);
    for (const c of consultas) expect(c).toMatch(/currency/);
  });

  it("cada importe se formatea por la moneda DEL PEDIDO", () => {
    // La defensa que sobrevive al día que alguien quite el filtro: sin ella un
    // pedido de USD 40 se imprimiría como "$40".
    expect(pagina).toContain('o.currency === "USD" ? formatUsd(Number(o.total)) : formatCop(Number(o.total))');
  });
});
