// Campaña de lanzamiento: el cupón llega en la bienvenida SOLO a quien crea
// la cuenta entre el 5 oct, 8:00 p. m., y el 9 oct, 8:00 p. m. (Colombia),
// como dice la publicación en redes.
import { describe, expect, it } from "vitest";
import { recibeCuponBienvenida } from "@/modules/buyer/welcome-email";

const col = (iso: string) => new Date(`${iso}-05:00`);

describe("ventana del cupón de bienvenida", () => {
  it("empieza a las 8:00 p. m. del 5 de octubre, hora de Colombia", () => {
    expect(recibeCuponBienvenida(col("2026-10-05T19:59:59"))).toBe(false);
    expect(recibeCuponBienvenida(col("2026-10-05T20:00:00"))).toBe(true);
  });

  it("termina a las 8:00 p. m. del viernes 9 de octubre", () => {
    expect(recibeCuponBienvenida(col("2026-10-07T12:00:00"))).toBe(true);
    expect(recibeCuponBienvenida(col("2026-10-09T19:59:59"))).toBe(true);
    expect(recibeCuponBienvenida(col("2026-10-09T20:00:00"))).toBe(false);
  });
});
