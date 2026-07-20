// Mensaje de WhatsApp y numeración del pedido (PED_HU002).
// Es el texto que el comprador le manda al operador: si está mal, el operador
// despacha mal. Por eso se prueba carácter a carácter.
import { describe, expect, it } from "vitest";
import {
  buildWhatsappMessage,
  compactAddress,
  formatOrderNumber,
  whatsappUrl,
} from "@/modules/orders/message";

const baseItems = [
  {
    qty: 2,
    productName: "Camiseta Essential",
    variantName: "Talla M",
    unitPrice: 79000,
    lineTotal: 158000,
  },
  {
    qty: 1,
    productName: "Vela aromática",
    variantName: "Única",
    unitPrice: 42000,
    lineTotal: 42000,
  },
];

const base = {
  orderNumber: "KO-2026-00042",
  currency: "COP" as const,
  items: baseItems,
  total: 200000,
  contactName: "Laura Gómez",
  contactPhone: "+573001234567",
  address: "Carrera 7 # 82 - 15, Barrio Chapinero, Bogotá, Bogotá D.C.",
  paymentPreference: "Nequi",
};

describe("número de pedido", () => {
  it("usa el formato KO-<año>-<5 dígitos>", () => {
    expect(formatOrderNumber(42, new Date("2026-07-19T15:00:00Z"))).toBe("KO-2026-00042");
    expect(formatOrderNumber(1, new Date("2026-01-01T15:00:00Z"))).toBe("KO-2026-00001");
    expect(formatOrderNumber(12345, new Date("2027-03-02T15:00:00Z"))).toBe("KO-2027-12345");
  });

  it("el año es el de Colombia, no el del servidor en UTC", () => {
    // 31 dic 2026, 8 p.m. en Bogotá = 1 ene 2027, 01:00 UTC.
    // El pedido pertenece al año 2026 para la contabilidad del cliente.
    expect(formatOrderNumber(7, new Date("2027-01-01T01:00:00Z"))).toBe("KO-2026-00007");
  });
});

describe("mensaje de WhatsApp", () => {
  it("arma el mensaje con la estructura acordada", () => {
    const message = buildWhatsappMessage(base);
    expect(message).toBe(
      [
        "Hola KORA 👋, quiero confirmar mi pedido *KO-2026-00042*:",
        "",
        "• 2 x Camiseta Essential (Talla M) — $79.000 = $158.000",
        "• 1 x Vela aromática — $42.000 = $42.000",
        "",
        "Total: $200.000 COP",
        "Entrega: Carrera 7 # 82 - 15, Barrio Chapinero, Bogotá, Bogotá D.C.",
        "Pago: Nequi",
        "Nombre: Laura Gómez · Tel: +573001234567",
      ].join("\n"),
    );
  });

  it("omite la variante cuando es 'Única' (no aporta nada al operador)", () => {
    const message = buildWhatsappMessage(base);
    expect(message).toContain("• 1 x Vela aromática — ");
    expect(message).not.toContain("(Única)");
  });

  it("incluye el cupón solo si se aplicó", () => {
    expect(buildWhatsappMessage(base)).not.toContain("Cupón");
    const conCupon = buildWhatsappMessage({
      ...base,
      discount: { code: "BIENVENIDA", amount: 20000 },
      total: 180000,
    });
    expect(conCupon).toContain("Cupón BIENVENIDA: −$20.000");
    expect(conCupon).toContain("Total: $180.000 COP");
  });

  it("respeta el formato de cada moneda", () => {
    const usd = buildWhatsappMessage({
      ...base,
      currency: "USD",
      items: [{ ...baseItems[0], unitPrice: 24.5, lineTotal: 49 }],
      total: 49,
    });
    expect(usd).toContain("— $24.50 = $49.00");
    expect(usd).toContain("Total: $49.00 USD");
  });
});

describe("URL de WhatsApp", () => {
  it("quita el + y los separadores del número, y codifica el texto", () => {
    const url = whatsappUrl("+57 320 827 0414", "Hola KORA 👋");
    expect(url.startsWith("https://api.whatsapp.com/send?phone=573208270414&text=")).toBe(
      true,
    );
    // El texto viaja codificado: los saltos de línea y emojis no rompen la URL.
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url.split("&text=")[1])).toBe("Hola KORA 👋");
  });

  it("NO usa el corto wa.me: su redirección corrompe el emoji del saludo", () => {
    // Comprobado en navegador: wa.me re-codifica y 👋 (4 bytes) llega como "�".
    const url = whatsappUrl("+573208270414", "Hola KORA 👋");
    expect(url).not.toContain("wa.me");
    expect(url).toContain("%F0%9F%91%8B"); // el emoji, codificado correctamente
  });

  it("un mensaje con saltos de línea sobrevive el viaje", () => {
    const message = buildWhatsappMessage(base);
    const url = whatsappUrl("+573208270414", message);
    expect(decodeURIComponent(url.split("&text=")[1])).toBe(message);
  });
});

describe("dirección compacta", () => {
  it("Colombia: incluye barrio y departamento, sin ZIP", () => {
    expect(
      compactAddress({
        country: "CO",
        address: "Carrera 7 # 82 - 15",
        address2: "Apto 502",
        neighborhood: "Chapinero",
        city: "Bogotá",
        state: "Bogotá D.C.",
      }),
    ).toBe("Carrera 7 # 82 - 15, Apto 502, Barrio Chapinero, Bogotá, Bogotá D.C.");
  });

  it("EE.UU.: incluye estado y ZIP, sin barrio", () => {
    expect(
      compactAddress({
        country: "US",
        address: "123 Main St",
        address2: "Apt 4B",
        city: "Miami",
        state: "Florida",
        zip: "33101",
      }),
    ).toBe("123 Main St, Apt 4B, Miami, Florida 33101");
  });

  it("omite los campos opcionales vacíos sin dejar comas sueltas", () => {
    expect(
      compactAddress({
        country: "CO",
        address: "Calle 1 # 2-3",
        city: "Medellín",
        state: "Antioquia",
      }),
    ).toBe("Calle 1 # 2-3, Medellín, Antioquia");
  });
});
