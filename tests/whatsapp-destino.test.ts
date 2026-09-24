// A dónde llegan los pedidos cuando la base no tiene número configurado.
// Producción cae a la línea comercial de KORA; pruebas y desarrollo, a la de
// Daniel — un pedido de prueba nunca debe llegarle al cliente, y uno real
// nunca debe perderse en un teléfono ajeno al negocio.
import { describe, expect, it } from "vitest";
import { defaultWhatsappNumber } from "@/modules/orders/settings";

describe("WhatsApp de pedidos por omisión", () => {
  it("producción usa la línea comercial de KORA", () => {
    expect(defaultWhatsappNumber({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("+573024456290");
  });

  it("pruebas y desarrollo NO usan la línea del cliente", () => {
    expect(defaultWhatsappNumber({ NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv)).toBe("+573142751611");
    expect(defaultWhatsappNumber({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("+573142751611");
  });
});
