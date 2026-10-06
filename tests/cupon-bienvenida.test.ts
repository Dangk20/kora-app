// Campaña de lanzamiento: el cupón llega en la bienvenida SOLO a quien crea
// la cuenta entre el 5 oct, 8:00 p. m., y el 6 oct, 8:00 p. m. (Colombia).
import { describe, expect, it } from "vitest";
import { recibeCuponBienvenida } from "@/modules/buyer/welcome-email";

const col = (iso: string) => new Date(`${iso}-05:00`);

describe("ventana del cupón de bienvenida", () => {
  it("empieza a las 8:00 p. m. del 5 de octubre, hora de Colombia", () => {
    expect(recibeCuponBienvenida(col("2026-10-05T19:59:59"))).toBe(false);
    expect(recibeCuponBienvenida(col("2026-10-05T20:00:00"))).toBe(true);
  });

  it("termina a las 8:00 p. m. del 6 de octubre", () => {
    expect(recibeCuponBienvenida(col("2026-10-06T19:59:59"))).toBe(true);
    expect(recibeCuponBienvenida(col("2026-10-06T20:00:00"))).toBe(false);
  });
});
