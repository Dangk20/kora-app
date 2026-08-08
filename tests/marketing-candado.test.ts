// Candado del módulo de Email marketing.
//
// Lo que se fija aquí no es la pantalla: es que NINGUNA acción del módulo se
// pueda ejecutar con el candado puesto. Ocultar el enlace del menú no cierra
// nada — la acción sigue estando a un POST de distancia.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertMarketingUnlocked,
  MarketingLockedError,
  marketingEnabled,
} from "@/modules/campaigns/lock";

describe("cuándo está abierto", () => {
  it("por omisión, CERRADO", () => {
    // Un entorno nuevo donde nadie se acuerde de la variable se queda cerrado.
    // Es el lado inofensivo del error: lo contrario sería que un despliegue
    // olvidado empiece a mandar correo a la base de clientes del cliente.
    expect(marketingEnabled({})).toBe(false);
    expect(marketingEnabled({ KORA_MARKETING_ENABLED: "" })).toBe(false);
  });

  it("solo se abre declarándolo en voz alta", () => {
    expect(marketingEnabled({ KORA_MARKETING_ENABLED: "1" })).toBe(true);
    expect(marketingEnabled({ KORA_MARKETING_ENABLED: "true" })).toBe(true);
    expect(marketingEnabled({ KORA_MARKETING_ENABLED: " TRUE " })).toBe(true);
  });

  it("un valor ambiguo NO abre", () => {
    // "sí", "on", "yes" y compañía no cuentan: la ambigüedad se resuelve hacia
    // cerrado, nunca hacia enviar.
    for (const v of ["0", "false", "no", "si", "on", "yes", "abierto"]) {
      expect(marketingEnabled({ KORA_MARKETING_ENABLED: v })).toBe(false);
    }
  });

  it("la guarda corta con un error que explica qué falta", () => {
    expect(() => assertMarketingUnlocked({})).toThrow(MarketingLockedError);
    try {
      assertMarketingUnlocked({});
    } catch (e) {
      expect((e as Error).message).toMatch(/SPF/);
      expect((e as Error).message).toMatch(/proveedor/i);
    }
    expect(() => assertMarketingUnlocked({ KORA_MARKETING_ENABLED: "1" })).not.toThrow();
  });
});

describe("dónde está puesto", () => {
  it("TODA acción del módulo pasa por la guarda, no solo las de envío", async () => {
    // Cerrar solo el envío dejaría componer y programar campañas que nadie va a
    // poder mandar: trabajo a medias esperando en la base.
    const fuente = await readFile("src/modules/campaigns/actions.ts", "utf8");
    const permisos = fuente.match(/requirePermission\("marketing:[a-z]+"\)/g) ?? [];
    const guardas = fuente.match(/assertMarketingUnlocked\(\)/g) ?? [];

    expect(permisos.length).toBeGreaterThan(0);
    expect(guardas.length).toBe(permisos.length);
  });

  it("el worker también lo respeta: es donde de verdad se envía", async () => {
    // Cerrarlo solo en el panel dejaría saliendo una campaña ya programada.
    const fuente = await readFile("src/modules/jobs/definitions.ts", "utf8");
    expect(fuente).toMatch(/marketingEnabled\(\)/);

    const trabajos = fuente.match(/name: "campaigns:[a-z]+"/g) ?? [];
    const comprobaciones = fuente.match(/if \(!marketingEnabled\(\)\)/g) ?? [];
    expect(trabajos.length).toBeGreaterThan(0);
    expect(comprobaciones.length).toBe(trabajos.length);
  });

  it("el candado no depende de nada del servidor: lo lee también el menú", async () => {
    const fuente = await readFile("src/modules/campaigns/lock.ts", "utf8");
    expect(fuente).not.toMatch(/from "@\/lib\/db"/);
    expect(fuente).not.toMatch(/next\/headers/);
  });
});

describe("lo que el candado NO toca", () => {
  it("los comprobantes del pedido son otra vía y siguen saliendo", async () => {
    // La baja de marketing ya no frena comprobantes (regla del módulo de
    // notificaciones); el candado tampoco puede hacerlo, o un comprador se
    // quedaría sin su única constancia de compra.
    const envio = await readFile("src/modules/notifications/send.ts", "utf8");
    expect(envio).not.toMatch(/campaigns\/lock/);
  });
});

describe("el título del panel", () => {
  it("cada módulo del menú tiene su entrada en el topbar", async () => {
    // `/admin` es prefijo de todas las rutas, así que el módulo que no declare
    // la suya se llama "Dashboard" y nada falla. Le pasó a Ventas, Cupones y
    // Email marketing a la vez.
    const [nav, topbar] = await Promise.all([
      readFile("src/app/admin/nav-links.tsx", "utf8"),
      readFile("src/app/admin/topbar.tsx", "utf8"),
    ]);

    const rutas = [...nav.matchAll(/href: "(\/admin\/[a-z]+)"/g)].map((m) => m[1]);
    expect(rutas.length).toBeGreaterThan(4);

    const sinTitulo = rutas.filter((r) => !topbar.includes(`prefix: "${r}"`));
    expect(sinTitulo).toEqual([]);
  });
});
