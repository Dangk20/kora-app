import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGAL_SLUGS, allLegalDocuments, esSlugLegal, legalDocument } from "@/modules/legal/content";
import type { LegalDocument } from "@/modules/legal/content";
import { merchant } from "@/modules/legal/config";
import { ORDER_TTL_HOURS } from "@/modules/orders/status";
import { TASA_CASHBACK, VIGENCIA_MESES } from "@/modules/cashback/money";
import { MARCAS_ACEPTADAS } from "@/modules/legal/payments";
import { LOCALES } from "@/modules/i18n";

const SOCIEDADES = {
  KORA_LEGAL_MATRICULA: "matrícula mercantil 0000000001 de la Cámara de Comercio de Ejemplo",
  KORA_LEGAL_LLC_RAZON_SOCIAL: "Example Holdings LLC",
  KORA_LEGAL_LLC_DOMICILIO: "1 Main St, Seattle, WA 98101, Estados Unidos",
  KORA_LEGAL_LLC_REGISTRO: "UBI 000000001 (Washington)",
};

const COMERCIANTE = merchant({
  NODE_ENV: "production",
  KORA_LEGAL_RAZON_SOCIAL: "Comercializadora Ejemplo S.A.S.",
  KORA_LEGAL_NIT: "900.123.456-7",
  KORA_LEGAL_DOMICILIO: "Calle 1 # 2-3, Bogotá D.C.",
  KORA_LEGAL_EMAIL: "datos@ejemplo.com",
  ...SOCIEDADES,
} as NodeJS.ProcessEnv);

/** Todo el texto del documento en una sola cadena, para buscar dentro. */
function texto(doc: LegalDocument): string {
  const partes: string[] = [doc.title, doc.summary];

  for (const section of doc.sections) {
    partes.push(section.heading, section.summary ?? "");
    for (const block of section.blocks) {
      if (block.kind === "list") partes.push(...block.items);
      else partes.push(block.text);
    }
  }

  return partes.join("\n");
}

const doc = (slug: (typeof LEGAL_SLUGS)[number], locale: "es" | "en" = "es") => legalDocument(slug, COMERCIANTE, locale);

describe("documentos legales — estructura", () => {
  it("los ocho documentos existen en los dos idiomas y se resuelven por su slug", () => {
    for (const locale of LOCALES) {
      expect(allLegalDocuments(COMERCIANTE, locale)).toHaveLength(8);
      for (const slug of LEGAL_SLUGS) {
        expect(doc(slug, locale).slug).toBe(slug);
      }
    }
  });

  it("solo los slugs conocidos son legales", () => {
    for (const slug of LEGAL_SLUGS) expect(esSlugLegal(slug)).toBe(true);
    for (const otro of ["inventada", "privacy", "", "cambios/", "../config"]) {
      expect(esSlugLegal(otro)).toBe(false);
    }
  });

  it("ningún documento sale vacío ni sin fecha de actualización", () => {
    for (const slug of LEGAL_SLUGS) for (const locale of LOCALES) {
      const d = doc(slug, locale);
      expect(d.title.length).toBeGreaterThan(10);
      expect(d.summary.length).toBeGreaterThan(20);
      expect(d.sections.length).toBeGreaterThan(2);
      expect(d.shortTitle.length).toBeGreaterThan(5);
      expect(d.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const section of d.sections) {
        expect(section.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it("los datos del comerciante se interpolan, no van escritos en el texto", () => {
    // Si alguien escribiera la razón social a mano dentro de un documento,
    // cambiar la variable de entorno dejaría media política desactualizada.
    const otro = merchant({
      NODE_ENV: "production",
      KORA_LEGAL_RAZON_SOCIAL: "Otra Sociedad Ltda.",
      KORA_LEGAL_NIT: "800.999.111-2",
      KORA_LEGAL_DOMICILIO: "Carrera 9 # 8-7, Medellín",
      KORA_LEGAL_EMAIL: "contacto@otra.com",
      KORA_LEGAL_MATRICULA: "matrícula 2",
      KORA_LEGAL_LLC_RAZON_SOCIAL: "Other Parent LLC",
      KORA_LEGAL_LLC_DOMICILIO: "2 Elm St, Austin, TX",
      KORA_LEGAL_LLC_REGISTRO: "SOS 2",
    } as NodeJS.ProcessEnv);

    for (const slug of LEGAL_SLUGS) for (const locale of LOCALES) {
      const t = texto(legalDocument(slug, otro, locale));
      for (const valor of ["Comercializadora Ejemplo", "900.123.456-7", ...Object.values(SOCIEDADES)]) {
        expect(t).not.toContain(valor);
      }
    }

    expect(texto(legalDocument("datos-personales", otro))).toContain("Otra Sociedad Ltda.");
  });
});

describe("política de cambios — los derechos irrenunciables se publican", () => {
  const t = () => texto(doc("cambios"));

  it("informa el derecho de retracto con su plazo legal", () => {
    // Ley 1480/2011 art. 47. Es irrenunciable en ventas a distancia, y KORA
    // vende a distancia por definición.
    expect(t()).toContain("retracto");
    expect(t()).toMatch(/5 días hábiles|cinco \(5\) días hábiles/i);
    expect(t()).toContain("Ley 1480 de 2011");
  });

  it("informa la garantía legal por producto defectuoso", () => {
    expect(t()).toMatch(/garantía legal/i);
    expect(t()).toMatch(/artículos 7 y 8|arts?\. 7 y 8/i);
  });

  it("dice explícitamente que se devuelve el dinero en esos casos", () => {
    expect(t()).toMatch(/devolvemos el dinero|devolución del dinero/i);
  });

  it("NO contiene una negación absoluta de devolución de dinero", () => {
    // La política del cliente (kora-cashback-reglas-cliente.md §6) dice "KORA no
    // realiza devoluciones de dinero". Publicado tal cual sería una cláusula
    // abusiva (Ley 1480/2011, arts. 42-43). Esta prueba existe para que ese
    // texto no vuelva a entrar por copiar y pegar la política comercial.
    const negaciones = [
      /no\s+(se\s+)?realiza\w*\s+devoluc/i,
      /no\s+(se\s+)?(hacen|hacemos|aceptan|aceptamos)\s+devoluc/i,
      /únicamente\s+se\s+aceptan\s+cambios/i,
      /no\s+hay\s+devoluc/i,
      /sin\s+derecho\s+a\s+devoluc/i,
    ];

    for (const patron of negaciones) {
      expect(t()).not.toMatch(patron);
    }
  });

  it("el retracto y la garantía van en secciones propias, no dentro de la política comercial", () => {
    // Meterlos como una salvedad dentro de la sección de cambios los haría
    // parecer condicionados a sus requisitos (etiquetas, empaque), y no lo están.
    const headings = doc("cambios").sections.map((s) => s.heading.toLowerCase());

    expect(headings.some((h) => h.includes("retracto"))).toBe(true);
    expect(headings.some((h) => h.includes("garantía"))).toBe(true);
    expect(headings.some((h) => h.includes("cambio"))).toBe(true);
  });

  it("publica el plazo comercial de cambio del cliente", () => {
    expect(t()).toContain("30 días calendario");
  });
});

describe("condiciones de venta — describen el negocio real", () => {
  const t = () => texto(doc("terminos"));

  it("describe las dos vías de pago: tarjeta en la página del procesador y otro medio por WhatsApp", () => {
    expect(t()).toMatch(/página de pago segura de nuestro procesador/i);
    expect(t()).toContain("WhatsApp");
  });

  it("NO niega el cobro en línea", () => {
    // Decía "no cobramos en línea" y "KORA no tiene pasarela de pago": lo
    // contrario de lo que el banco espera leer en un comercio con pago alojado.
    for (const locale of LOCALES) for (const slug of LEGAL_SLUGS) {
      const c = texto(doc(slug, locale));
      for (const patron of [/no cobramos en línea/i, /no tiene pasarela/i, /no procesa pagos/i, /we do not charge online/i]) {
        expect(c).not.toMatch(patron);
      }
    }
  });

  it("el plazo de vigencia publicado es el que el sistema aplica de verdad", () => {
    // Si alguien cambia ORDER_TTL_HOURS, este test falla y obliga a revisar el
    // texto. Un número copiado a mano en una legal es una promesa que caduca
    // en silencio.
    expect(t()).toContain(`${ORDER_TTL_HOURS} horas`);
  });

  it("la tasa y la vigencia del cashback salen de sus constantes, en los dos idiomas", () => {
    expect(texto(doc("promociones"))).toContain(`${Math.round(TASA_CASHBACK * 100)} %`);
    expect(texto(doc("promociones"))).toContain(`${VIGENCIA_MESES} meses`);
    expect(texto(doc("promociones", "en"))).toContain(`${Math.round(TASA_CASHBACK * 100)}%`);
    expect(texto(doc("promociones", "en"))).toContain(`${VIGENCIA_MESES} months`);
  });

  it("advierte que las monedas no se convierten entre sí", () => {
    expect(t()).toMatch(/no aplicamos ninguna conversión|sin conversión/i);
  });

  it("no promete servicios que el negocio no sostiene", () => {
    // Misma decisión ya tomada para la tienda pública: el prototipo prometía
    // cuotas, compra protegida y envío gratis, y ninguna es cierta hoy.
    for (const patron of [/compra protegida/i, /envío gratis/i, /sin interés/i, /cuotas/i]) {
      expect(t()).not.toMatch(patron);
    }
  });

  it("no usa las palabras retiradas del producto", () => {
    // "CRM" (acuerdo 18 jul) y "KoraPuntos"/"puntos" (1 ago) no vuelven.
    for (const slug of LEGAL_SLUGS) {
      const contenido = texto(doc(slug));
      expect(contenido).not.toMatch(/\bCRM\b/);
      expect(contenido).not.toMatch(/KoraPuntos|kora\s?puntos/i);
    }
  });
});

describe("política de datos — sostiene el consentimiento del checkout", () => {
  const t = () => texto(doc("datos-personales"));

  it("identifica al responsable con razón social, NIT y domicilio", () => {
    expect(t()).toContain(COMERCIANTE.razonSocial);
    expect(t()).toContain(COMERCIANTE.nit);
    expect(t()).toContain(COMERCIANTE.domicilio);
  });

  it("presenta al responsable como sociedad, no como persona natural", () => {
    expect(t()).toContain(`sociedad identificada con NIT ${COMERCIANTE.nit}`);
    expect(texto(doc("terminos"))).toContain(`sociedad en Colombia, identificada con NIT ${COMERCIANTE.nit}`);
  });

  it("publica un canal de atención al titular", () => {
    expect(t()).toContain(COMERCIANTE.email);
  });

  it("enumera los derechos del titular y los plazos de respuesta", () => {
    expect(t()).toContain("Ley 1581 de 2012");
    for (const derecho of ["Conocer", "rectificar", "supresión", "Revocar"]) {
      expect(t()).toContain(derecho);
    }
    expect(t()).toMatch(/diez \(10\) días hábiles/);
    expect(t()).toMatch(/quince \(15\) días hábiles/);
  });

  it("distingue el marketing de las finalidades necesarias del pedido", () => {
    // La baja de marketing no frena un comprobante: es la regla que ya sostiene
    // el módulo de notificaciones, y la política tiene que decir lo mismo.
    expect(t()).toMatch(/autorización aparte|finalidad distinta/i);
    expect(t()).toMatch(/no cancela los comprobantes|no son publicidad/i);
  });

  it("no promete cookies de terceros que la tienda no usa", () => {
    expect(t()).toMatch(/estrictamente necesarias/i);
    expect(t()).toMatch(/no usamos cookies de publicidad/i);
  });
});

describe("centro legal — dos idiomas, mismas secciones", () => {
  it("cada documento tiene en inglés las mismas secciones, en el mismo orden y con la misma ancla", () => {
    // El equivalente de `typeof es` en los diccionarios: una sección sin
    // traducir, o traducida en otro orden, rompe el cambio de idioma.
    for (const slug of LEGAL_SLUGS) {
      const es = doc(slug, "es").sections.map((s) => s.id);
      const en = doc(slug, "en").sections.map((s) => s.id);
      expect(en, slug).toEqual(es);
      expect(new Set(es).size, `${slug}: anclas repetidas`).toBe(es.length);
    }
  });

  it("la versión en inglés dice que prevalece la española", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(texto(doc(slug, "en")), slug).toMatch(/Spanish version of this document prevails/);
    }
  });
});

describe("normas de las redes de tarjetas — lo que el banco pide encontrar", () => {
  it("dirección física y país de las dos sociedades, con sus registros", () => {
    const c = texto(doc("comercio"));
    for (const valor of [
      COMERCIANTE.domicilio,
      COMERCIANTE.nit,
      COMERCIANTE.matricula,
      COMERCIANTE.llc.razonSocial,
      COMERCIANTE.llc.domicilio,
      COMERCIANTE.llc.registro,
      "Estados Unidos",
      "Colombia",
    ]) {
      expect(c).toContain(valor);
    }
  });

  it("contacto de atención: correo, y teléfono cuando se conoce", () => {
    const c = texto(legalDocument("comercio", COMERCIANTE, "es", { whatsapp: "+573024456290" }));
    expect(c).toContain(COMERCIANTE.email);
    expect(c).toContain("+57 302 445 6290");
  });

  it("monedas de transacción y marcas aceptadas", () => {
    for (const locale of LOCALES) {
      const c = texto(doc("seguridad-pagos", locale));
      expect(c).toContain("COP");
      expect(c).toContain("USD");
      for (const marca of MARCAS_ACEPTADAS) expect(c).toContain(marca.nombre);
    }
  });

  it("las transferencias por país se anuncian en los dos idiomas", () => {
    for (const locale of LOCALES) {
      const c = texto(doc("seguridad-pagos", locale)) + texto(doc("terminos", locale));
      for (const medio of ["Nequi", "Bre-B", "Zelle"]) expect(c, `${locale}: ${medio}`).toContain(medio);
    }
  });

  it("KORA no recibe ni almacena datos de tarjeta, en seguridad y en privacidad", () => {
    expect(texto(doc("seguridad-pagos"))).toMatch(/no recibe, no ve y no almacena/);
    expect(texto(doc("datos-personales"))).toMatch(/No recibimos, no vemos y no almacenamos los datos de tu tarjeta/);
    expect(texto(doc("seguridad-pagos", "en"))).toMatch(/does not receive, see or store/);
  });

  it("política de entrega: solo Colombia y sin exportación", () => {
    const e = texto(doc("envios"));
    expect(e).toMatch(/únicamente en Colombia/);
    expect(e).toMatch(/No realizamos envíos internacionales ni exportamos productos/);
    expect(texto(doc("terminos"))).toMatch(/Restricciones legales y de exportación/);
  });

  it("reembolsos con tarjeta: a la misma tarjeta", () => {
    expect(texto(doc("cambios"))).toMatch(/reembolso se hace a la misma tarjeta/);
    expect(texto(doc("cambios", "en"))).toMatch(/refund goes to the same card/);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("condiciones de las promociones, que se retiran solas al vencer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    expect(texto(doc("promociones"))).toContain("BIENVENIDOSAKORA");
    expect(texto(doc("promociones"))).toMatch(/Reglas generales de los cupones/);

    // Vencida, no se sigue prometiendo: la página es dinámica.
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    expect(texto(doc("promociones"))).not.toContain("BIENVENIDOSAKORA");
    expect(texto(doc("promociones"))).toMatch(/no hay promociones públicas vigentes/);
  });

  it("la transferencia de datos a la matriz en EE.UU. se declara", () => {
    expect(texto(doc("datos-personales"))).toMatch(/transferencia internacional de datos/);
    expect(texto(doc("datos-personales"))).toContain(COMERCIANTE.llc.razonSocial);
  });
});
