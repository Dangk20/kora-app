// La vigencia del pedido pendiente se define UNA vez.
//
// Hasta el 27 ago 2026 había dos definiciones de la misma regla:
// `ORDER_TTL_HOURS` en status.ts, que solo redactaba el texto de
// /legal/terminos, y una copia escrita a mano en checkout-actions.ts, que era
// la que de verdad escribía `expiresAt`.
//
// Lo que hace peligrosa esa duplicación es cómo falla: cambiando solo la
// primera, la página de términos promete un plazo y el sistema aplica otro, y
// la suite entera sigue verde — porque la prueba que vigila el texto legal lo
// compara contra esa misma constante equivocada. Es una promesa publicada a
// compradores que el sistema no cumple, sin un solo error en ninguna pantalla.
//
// Se descubrió justo al subir el plazo de 2 h a 24 h a petición del cliente
// (reunión del 7 ago), que es exactamente el cambio que lo habría destapado en
// producción.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ORDER_TTL_HOURS, ORDER_TTL_MS } from "@/modules/orders/status";

describe("vigencia del pedido — una sola definición", () => {
  it("los milisegundos se DERIVAN de las horas, no se escriben aparte", () => {
    expect(ORDER_TTL_MS).toBe(ORDER_TTL_HOURS * 60 * 60 * 1000);
  });

  it("es la vigencia de 24 h que pidió el cliente", () => {
    // Si esto cambia, hay que decírselo a él: no es un detalle interno. El
    // cashback se descuenta al CREAR el pedido, así que el plazo decide cuánto
    // tiempo queda comprometido el saldo de un comprador por un pedido que
    // quizá nunca se confirme.
    expect(ORDER_TTL_HOURS).toBe(24);
  });

  it("quien crea el pedido IMPORTA la constante y no define la suya", () => {
    // Garantía estructural, como la del correo: no basta con que hoy los dos
    // números coincidan, porque el defecto aparece cuando alguien cambia uno.
    const src = readFileSync(
      join(process.cwd(), "src/modules/orders/checkout-actions.ts"),
      "utf8",
    );

    expect(src, "debe importar la vigencia de status.ts").toContain(
      'import { ORDER_TTL_MS } from "./status"',
    );

    // Ninguna línea puede volver a calcular el plazo a mano. El patrón busca
    // justo la forma que tenía la copia: `= <n> * 60 * 60 * 1000`.
    const copiaAMano = /ORDER_TTL_\w*\s*=\s*\d+\s*\*\s*60\s*\*\s*60\s*\*\s*1000/;
    expect(src, "no debe redefinir la vigencia").not.toMatch(copiaAMano);
  });
});
