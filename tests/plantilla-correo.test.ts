// Las piezas visuales de la plantilla de correo.
//
// Se prueban por una razón concreta: un correo no se puede corregir después de
// enviarlo. Si el código sale sin su caja, o la línea de tiempo marca el paso
// equivocado, eso ya está en la bandeja de alguien.
import { describe, expect, it } from "vitest";
import { renderCampaign } from "@/modules/email/template";
import { renderOrderEmail, type OrderEmailData } from "@/modules/notifications/render";

const BASE = {
  subject: "Prueba",
  title: "Prueba",
  body: "Cuerpo",
  products: [],
  unsubscribeUrl: "",
};

const PEDIDO: OrderEmailData = {
  orderId: "x",
  orderNumber: "KO-2026-00001",
  buyerName: "Alex",
  whatsappUrl: "https://api.whatsapp.com/send?phone=1",
  order: {
    number: "KO-2026-00001",
    currency: "COP" as const,
    lines: [{ qty: 1, name: "Producto", variant: "Única", total: 10_000 }],
    subtotal: 10_000,
    discountTotal: 0,
    cashbackApplied: 0,
    total: 10_000,
  },
};

describe("el bloque del código", () => {
  it("sale grande y separado, no perdido en un párrafo", () => {
    const { html } = renderCampaign({ ...BASE, code: "480291" });
    expect(html).toContain("480291");
    expect(html).toMatch(/letter-spacing:\s*10px/);
    expect(html).toMatch(/font-size:\s*34px/);
  });

  it("🔒 el código va TAMBIÉN en la versión de texto plano", () => {
    // Quien lee sin imágenes ni estilos —o con lector de pantalla— viene
    // exactamente a por esto. Si solo existiera en el HTML, para esa persona el
    // correo no serviría para nada.
    const { text } = renderCampaign({ ...BASE, code: "480291" });
    expect(text).toContain("480291");
  });

  it("sin código no aparece la caja", () => {
    expect(renderCampaign(BASE).html).not.toMatch(/letter-spacing:\s*10px/);
  });
});

describe("la línea de tiempo", () => {
  it("marca el paso correcto en cada correo de estado", () => {
    const pasos: [Parameters<typeof renderOrderEmail>[0], string][] = [
      ["BUYER_CONFIRMED", "[>] Pago confirmado"],
      ["BUYER_PREPARING", "[>] En preparación"],
      ["BUYER_SHIPPED", "[>] En camino"],
      ["BUYER_DELIVERED", "[>] Entregado"],
    ];
    for (const [tipo, esperado] of pasos) {
      expect(renderOrderEmail(tipo, PEDIDO).text, `${tipo}`).toContain(esperado);
    }
  });

  it("los pasos anteriores salen ya recorridos", () => {
    const { text } = renderOrderEmail("BUYER_SHIPPED", PEDIDO);
    expect(text).toContain("[x] Pago confirmado");
    expect(text).toContain("[x] En preparación");
    expect(text).toContain("[ ] Entregado");
  });

  it("🔒 los correos que NO son del recorrido no la llevan", () => {
    // Un pedido cancelado no está en un punto del camino, está fuera de él.
    // Y antes de pagar no hay recorrido que enseñar.
    for (const tipo of ["BUYER_CREATED", "BUYER_CANCELLED", "STAFF_NEW_ORDER"] as const) {
      expect(renderOrderEmail(tipo, PEDIDO).text, tipo).not.toContain("Estado de tu pedido:");
    }
  });
});

describe("el lenguaje no le asigna género a nadie", () => {
  it("🔒 ningún correo dice 'bienvenido', 'estimado' ni 'querido'", () => {
    // El correo es el primer contacto y muchas veces el único. Dar por hecho el
    // género de quien compra es equivocarse con una parte de la clientela.
    const tipos = [
      "BUYER_CREATED",
      "BUYER_CONFIRMED",
      "BUYER_PREPARING",
      "BUYER_SHIPPED",
      "BUYER_DELIVERED",
      "BUYER_CANCELLED",
      "BUYER_PAYMENT_REMINDER",
      "STAFF_NEW_ORDER",
    ] as const;

    const generado = /\b(bienvenid[oa]|estimad[oa]|querid[oa])\b/i;
    for (const tipo of tipos) {
      const { subject, text } = renderOrderEmail(tipo, { ...PEDIDO, hoursLeft: 1 });
      expect(`${subject} ${text}`, tipo).not.toMatch(generado);
    }
  });
});

describe("el correo sobrevive al modo oscuro", () => {
  // Gmail en el móvil INVIERTE los colores por su cuenta cuando el correo no
  // declara que entiende los dos esquemas, y lo hace mal: el 28 ago 2026 el
  // botón salía con texto oscuro sobre naranja —ilegible— y las barras del
  // recorrido desaparecían del todo.
  it("declara que entiende los dos esquemas", () => {
    const { html } = renderCampaign({ ...BASE, ctaLabel: "Ir", ctaUrl: "https://x.co" });
    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('name="supported-color-schemes"');
  });

  it("🔒 el texto del botón se declara blanco con !important", () => {
    // Es lo único que impide que el inversor de Gmail lo oscurezca.
    const { html } = renderCampaign({ ...BASE, ctaLabel: "Ir", ctaUrl: "https://x.co" });
    expect(html).toMatch(/color:#ffffff !important/);
  });

  it("🔒 las barras del recorrido usan un gris MEDIO, no uno claro", () => {
    // Un #e4e6ea se invierte a casi negro sobre fondo oscuro y desaparece.
    const { html } = renderOrderEmail("BUYER_SHIPPED", PEDIDO);
    expect(html).toContain("#9aa0a8");
    expect(html).not.toContain("#e4e6ea");
  });

  it("🔒 los iconos NO son imágenes: no dependen de descargar nada", () => {
    // Se intentaron como PNG servidos desde la tienda y salieron rotos: una
    // imagen en un correo necesita una URL pública, y la tienda todavía no la
    // tiene. Aunque la tuviera, los clientes las bloquean por defecto y el
    // recorrido dependería de un clic.
    const { html } = renderOrderEmail("BUYER_SHIPPED", PEDIDO);
    expect(html).not.toContain("/email/");
    expect(html).not.toMatch(/<img[^>]+pago/);
    // Los glifos sí están, y se dibujan sin descargar nada.
    expect(html).toContain("💳");
    expect(html).toContain("🚚");
  });
});
