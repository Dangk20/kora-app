// "Cargar más" del catálogo: cuántos productos se pintan de golpe.
//
// Sin tope, el catálogo real (~1.000 productos) manda todas las tarjetas en la
// primera respuesta: cientos de imágenes y un HTML enorme, en un teléfono con
// datos móviles. Y el parámetro llega de la URL, así que hay que acotarlo —
// `?ver=999999` no puede tumbar la página.
import { describe, expect, it } from "vitest";

const POR_PAGINA = 12;

/** La misma cuenta que hace la página, aislada para poder probarla. */
function visibles(ver: string | undefined, total: number): number {
  const pedidos = Number(ver);
  return Math.min(
    Number.isFinite(pedidos) && pedidos > 0
      ? Math.ceil(pedidos / POR_PAGINA) * POR_PAGINA
      : POR_PAGINA,
    total,
  );
}

describe("cuántos productos se pintan", () => {
  it("sin parámetro, la primera página", () => {
    expect(visibles(undefined, 100)).toBe(12);
  });

  it("nunca más de los que hay", () => {
    expect(visibles("24", 21)).toBe(21);
    expect(visibles(undefined, 5)).toBe(5);
  });

  it("cada 'Cargar más' suma una página", () => {
    expect(visibles("24", 100)).toBe(24);
    expect(visibles("36", 100)).toBe(36);
  });

  it("redondea a página completa: no se pueden pedir 13", () => {
    // Si no, un valor a mano deja una fila coja y el siguiente salto
    // descuadrado respecto a la rejilla.
    expect(visibles("13", 100)).toBe(24);
  });

  it.each(["0", "-5", "abc", "", "NaN", "1e999"])(
    "un valor inválido (%s) cae a la primera página",
    (malo) => {
      expect(visibles(malo, 100)).toBe(12);
    },
  );

  it("un valor enorme se acota al total, no revienta", () => {
    // `?ver=999999` no puede pintar más de lo que existe.
    expect(visibles("999999", 100)).toBe(100);
  });
});
