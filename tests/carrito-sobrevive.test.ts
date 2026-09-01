// El carrito no se puede vaciar antes de que el comprador vea su pedido.
//
// EL FALLO QUE ESTO IMPIDE (encontrado por Daniel probando, 31 ago 2026):
// `clear()` corría en el instante en que el servidor creaba el pedido —antes
// de que el comprador viera nada, con la pantalla de proceso todavía
// contándose—. Un "atrás" en esa ventana, un misclic, le dejaba el carrito
// vacío y un pedido creado que jamás vio: desde su lado todo se desvaneció y
// no sabía si había comprado. Desde el lado del negocio, un pedido pendiente
// que nadie iba a enviar.
//
// Son tests de código fuente porque lo que se defiende es *dónde* ocurre el
// vaciado, y eso no se puede comprobar desde el resultado de una función.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vista = readFileSync("src/app/(tienda)/checkout/checkout-view.tsx", "utf8");
const puente = readFileSync("src/app/(tienda)/checkout/order-bridge.tsx", "utf8");

describe("el carrito sobrevive hasta que el comprador ve su pedido", () => {
  it("crear el pedido NO vacía el carrito", () => {
    // La forma exacta que tenía el fallo.
    expect(vista).not.toContain("clear(); // el carrito se vacía");
    const creacion = vista.slice(
      vista.indexOf("const result = await createOrder"),
      vista.indexOf("setError({"),
    );
    expect(creacion).not.toMatch(/\bclear\(\)/);
  });

  it("el carrito se vacía al llegar al puente de WhatsApp, no antes", () => {
    expect(vista).toContain("onLlegada={clear}");
    expect(puente).toContain("onLlegada?.()");
  });

  it("el pedido creado queda registrado para poder volver a él", () => {
    // Sin esto, conservar el carrito dejaría el pedido invisible: el
    // comprador crearía un segundo pedido sin saber que ya tenía uno.
    expect(vista).toContain("recordarPedidoSinEnviar({");
    expect(vista).toContain("leerPedidoSinEnviar()");
  });

  it("se olvida cuando el comprador llega de verdad a WhatsApp", () => {
    expect(puente).toContain("onEnviado?.()");
    expect(vista).toContain("onEnviado={olvidarPedidoSinEnviar}");
  });
});

describe("el registro del pedido sin enviar", () => {
  const modulo = readFileSync("src/modules/cart/pedido-sin-enviar.ts", "utf8");

  it("caduca con la misma vigencia que el pedido (2 h)", () => {
    // Ofrecer volver a un pedido ya vencido mandaría al comprador a una
    // conversación sobre algo que el panel descartó.
    expect(modulo).toContain("const VIGENCIA_MS = 2 * 60 * 60 * 1000");
    expect(modulo).toMatch(/Date\.now\(\) - pedido\.creadoEn > VIGENCIA_MS/);
  });

  it("nunca revienta si el almacenamiento está bloqueado", () => {
    // Incógnito con storage cerrado: se pierde el hilo de vuelta, pero la
    // compra no se cae por eso — el pedido vive en la base.
    const capturas = modulo.match(/catch\s*\{/g) ?? [];
    expect(capturas.length).toBeGreaterThanOrEqual(3);
  });
});

describe("enviar el pedido desde el aviso de rescate", () => {
  // Segundo hallazgo de Daniel, el mismo día: enviarlo desde el aviso dejaba
  // el carrito lleno. Solo el puente lo vaciaba, así que rescatar un pedido
  // te devolvía a una tienda con los productos que acababas de pedir.
  it("también vacía el carrito, no solo el puente", () => {
    const aviso = vista.slice(
      vista.indexOf("href={pendiente.whatsappUrl}"),
      vista.indexOf("Abrir WhatsApp"),
    );
    expect(aviso).toContain("clear()");
    expect(aviso).toContain("olvidarPedidoSinEnviar()");
  });

  it("pero SOLO si el carrito sigue siendo el mismo del que salió el pedido", () => {
    // Si el comprador volvió atrás y añadió cosas, vaciarlo le borraría
    // productos que nunca pidió. La huella es lo que separa los dos casos.
    const aviso = vista.slice(
      vista.indexOf("href={pendiente.whatsappUrl}"),
      vista.indexOf("Abrir WhatsApp"),
    );
    expect(aviso).toContain("pendiente.huella === huellaDeCarrito(lines)");
  });

  it("la huella se guarda al crear el pedido", () => {
    expect(vista).toContain("huella: huellaDeCarrito(lines)");
  });

  it("la huella no depende del orden en que se armó el carrito", () => {
    const modulo = readFileSync("src/modules/cart/pedido-sin-enviar.ts", "utf8");
    expect(modulo).toMatch(/\.sort\(\)/);
  });
});
