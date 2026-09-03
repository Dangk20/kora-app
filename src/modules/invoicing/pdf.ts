// El comprobante de pedido, dibujado.
//
// ⚠️ ESTE ARCHIVO NO PUEDE IMPORTAR NADA DE NEXT. Lo usa el worker de la
// bandeja de eventos, que corre fuera de Next, igual que `session.ts` no
// importa `next/headers`.
//
// `pdf-lib` es JavaScript puro: sin binarios nativos, sin leer fuentes del
// disco. Se eligió por eso. `pdfkit` lee sus métricas `.afm` del paquete en
// tiempo de ejecución —el mismo patrón que hundió a `sharp` tres despliegues
// seguidos— y cualquier opción basada en navegador sin cabeza arrastra
// Chromium a la imagen.
//
// La tipografía es Helvetica, la estándar del formato PDF, que vive dentro del
// visor. La marca entra por el logo y el color, no por la fuente: embeber
// Manrope costaría ~200 KB en la imagen para un documento que se imprime.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { variantDetails } from "@/modules/orders/message";
import { formatMoney } from "@/modules/pricing";
import { LOGO_KORA_PNG } from "./logo";
import type { SalesDocumentSnapshot } from "./snapshot";

const CORAL = rgb(1, 0.353, 0.122); // #ff5a1f
const NEGRO = rgb(0.071, 0.071, 0.071); // #121212
const GRIS = rgb(0.42, 0.44, 0.47);
const LINEA = rgb(0.88, 0.87, 0.85);

const ANCHO = 595.28; // A4
const ALTO = 841.89;
const MARGEN = 48;
const DERECHA = ANCHO - MARGEN;

/**
 * Helvetica del PDF codifica WinAnsi, que no cubre todo Unicode: un carácter
 * fuera de ese juego hace que `pdf-lib` LANCE.
 *
 * No es hipotético. Los nombres de producto los carga el cliente desde su
 * Excel y traen de todo —viñetas, comillas tipográficas, flechas, emojis—, y
 * las fechas en español producen espacios finos que tampoco están. Sin esto,
 * un solo "★" en un nombre de producto tumbaría el comprobante de esa compra,
 * y con él el correo de confirmación.
 */
function limpiar(texto: string): string {
  return texto
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[    ]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  negrita: PDFFont;
};

function texto(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  opciones: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number } = {},
) {
  const size = opciones.size ?? 9;
  const font = opciones.bold ? ctx.negrita : ctx.regular;
  let valor = limpiar(s);
  if (opciones.maxWidth) valor = recortar(valor, font, size, opciones.maxWidth);
  ctx.page.drawText(valor, { x, y, size, font, color: opciones.color ?? NEGRO });
}

function textoDerecha(
  ctx: Ctx,
  s: string,
  xDerecha: number,
  y: number,
  opciones: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
) {
  const size = opciones.size ?? 9;
  const font = opciones.bold ? ctx.negrita : ctx.regular;
  const valor = limpiar(s);
  const ancho = font.widthOfTextAtSize(valor, size);
  ctx.page.drawText(valor, {
    x: xDerecha - ancho,
    y,
    size,
    font,
    color: opciones.color ?? NEGRO,
  });
}

function recortar(s: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  let corte = s;
  while (corte.length > 1 && font.widthOfTextAtSize(`${corte}...`, size) > maxWidth) {
    corte = corte.slice(0, -1);
  }
  return `${corte}...`;
}

function linea(ctx: Ctx, y: number) {
  ctx.page.drawLine({
    start: { x: MARGEN, y },
    end: { x: DERECHA, y },
    thickness: 0.7,
    color: LINEA,
  });
}

/**
 * El día del negocio es America/Bogota, nunca el huso del servidor —que corre
 * en UTC—. Una confirmación de las 8 p.m. en Bogotá ya es del día siguiente en
 * UTC: un comprobante fechado así lleva el día equivocado, y parece correcto.
 */
function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function importe(valor: string, currency: "COP" | "USD"): string {
  return formatMoney(Number(valor), currency);
}

export async function renderSalesDocumentPdf(
  snapshot: SalesDocumentSnapshot,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Comprobante de pedido ${snapshot.orderCode}`);
  doc.setProducer("KORA");
  doc.setCreator("KORA");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(LOGO_KORA_PNG);

  const ctx: Ctx = { doc, page: doc.addPage([ANCHO, ALTO]), y: ALTO - MARGEN, regular, negrita };
  const moneda = snapshot.currency;

  // ── Encabezado ──
  const anchoLogo = 110;
  const altoLogo = (logo.height / logo.width) * anchoLogo;
  ctx.page.drawImage(logo, { x: MARGEN, y: ctx.y - altoLogo, width: anchoLogo, height: altoLogo });

  textoDerecha(ctx, "COMPROBANTE DE PEDIDO", DERECHA, ctx.y - 8, {
    size: 8.5,
    bold: true,
    color: CORAL,
  });
  textoDerecha(ctx, snapshot.orderCode, DERECHA, ctx.y - 27, { size: 15, bold: true });
  textoDerecha(ctx, fechaLarga(snapshot.issuedAt), DERECHA, ctx.y - 41, {
    size: 8.5,
    color: GRIS,
  });

  ctx.y -= 62;

  // ── Comerciante ──
  texto(ctx, snapshot.merchant.razonSocial, MARGEN, ctx.y, { size: 10.5, bold: true });
  ctx.y -= 13;
  texto(ctx, `NIT ${snapshot.merchant.nit}`, MARGEN, ctx.y, { size: 8.5, color: GRIS });
  ctx.y -= 11;
  texto(ctx, snapshot.merchant.domicilio, MARGEN, ctx.y, { size: 8.5, color: GRIS });
  ctx.y -= 11;
  texto(ctx, snapshot.merchant.email, MARGEN, ctx.y, { size: 8.5, color: GRIS });

  ctx.y -= 18;
  linea(ctx, ctx.y);
  ctx.y -= 20;

  // ── Comprador y entrega, en dos columnas ──
  const colDerecha = MARGEN + 265;
  const yBloque = ctx.y;

  texto(ctx, "COMPRADOR", MARGEN, yBloque, { size: 7.5, bold: true, color: GRIS });
  let yc = yBloque - 14;
  for (const l of lineasComprador(snapshot)) {
    texto(ctx, l, MARGEN, yc, { size: 9, maxWidth: 240 });
    yc -= 12;
  }

  let ye = yBloque;
  if (snapshot.shipping) {
    texto(ctx, "ENVIAR A", colDerecha, yBloque, { size: 7.5, bold: true, color: GRIS });
    ye = yBloque - 14;
    for (const l of lineasEnvio(snapshot)) {
      texto(ctx, l, colDerecha, ye, { size: 9, maxWidth: 235 });
      ye -= 12;
    }
  }

  ctx.y = Math.min(yc, ye) - 12;
  linea(ctx, ctx.y);
  ctx.y -= 18;

  // ── Tabla ──
  const X_CANT = MARGEN + 300;
  const X_UNIT = MARGEN + 390;
  texto(ctx, "DESCRIPCIÓN", MARGEN, ctx.y, { size: 7.5, bold: true, color: GRIS });
  textoDerecha(ctx, "CANT.", X_CANT, ctx.y, { size: 7.5, bold: true, color: GRIS });
  textoDerecha(ctx, "VR. UNITARIO", X_UNIT, ctx.y, { size: 7.5, bold: true, color: GRIS });
  textoDerecha(ctx, "TOTAL", DERECHA, ctx.y, { size: 7.5, bold: true, color: GRIS });
  ctx.y -= 8;
  linea(ctx, ctx.y);
  ctx.y -= 16;

  for (const l of snapshot.lines) {
    // Salto de página con el mismo encabezado de tabla: un comprobante largo no
    // puede perder las columnas a mitad de lista.
    if (ctx.y < 150) {
      ctx.page = doc.addPage([ANCHO, ALTO]);
      ctx.y = ALTO - MARGEN;
      texto(ctx, "DESCRIPCIÓN", MARGEN, ctx.y, { size: 7.5, bold: true, color: GRIS });
      textoDerecha(ctx, "CANT.", X_CANT, ctx.y, { size: 7.5, bold: true, color: GRIS });
      textoDerecha(ctx, "VR. UNITARIO", X_UNIT, ctx.y, { size: 7.5, bold: true, color: GRIS });
      textoDerecha(ctx, "TOTAL", DERECHA, ctx.y, { size: 7.5, bold: true, color: GRIS });
      ctx.y -= 8;
      linea(ctx, ctx.y);
      ctx.y -= 16;
    }

    texto(ctx, l.productName, MARGEN, ctx.y, { size: 9.5, bold: true, maxWidth: 275 });
    textoDerecha(ctx, String(l.qty), X_CANT, ctx.y, { size: 9.5 });
    textoDerecha(ctx, importe(l.unitPrice, moneda), X_UNIT, ctx.y, { size: 9.5 });
    textoDerecha(ctx, importe(l.total, moneda), DERECHA, ctx.y, { size: 9.5, bold: true });
    ctx.y -= 11;

    // `variantDetails` decide qué de la variante merece enseñarse. Se reutiliza
    // en vez de decidirlo aquí para que un producto sin variantes no diga
    // "Única" en el comprobante mientras el mensaje de WhatsApp lo omite: son
    // el mismo pedido y no pueden describirlo distinto.
    const detalle = [...variantDetails(l.variantName), `SKU ${l.sku}`].join("  ·  ");
    texto(ctx, detalle, MARGEN, ctx.y, { size: 8, color: GRIS, maxWidth: 275 });
    ctx.y -= 16;
  }

  // ── Totales ──
  ctx.y -= 2;
  linea(ctx, ctx.y);
  ctx.y -= 16;

  const filaTotal = (etiqueta: string, valor: string, fuerte = false) => {
    textoDerecha(ctx, etiqueta, X_UNIT, ctx.y, {
      size: fuerte ? 10.5 : 9,
      bold: fuerte,
      color: fuerte ? NEGRO : GRIS,
    });
    textoDerecha(ctx, valor, DERECHA, ctx.y, { size: fuerte ? 12 : 9, bold: true });
    ctx.y -= fuerte ? 18 : 14;
  };

  filaTotal("Subtotal", importe(snapshot.totals.subtotal, moneda));
  if (Number(snapshot.totals.discount) > 0) {
    filaTotal("Descuento", `-${importe(snapshot.totals.discount, moneda)}`);
  }
  if (Number(snapshot.totals.cashbackApplied) > 0) {
    filaTotal("Kora Cashback", `-${importe(snapshot.totals.cashbackApplied, moneda)}`);
  }
  ctx.y -= 2;
  filaTotal(`TOTAL ${moneda}`, importe(snapshot.totals.total, moneda), true);

  if (snapshot.paymentPreference) {
    ctx.y -= 2;
    textoDerecha(ctx, `Medio de pago: ${snapshot.paymentPreference}`, DERECHA, ctx.y, {
      size: 8.5,
      color: GRIS,
    });
    ctx.y -= 14;
  }

  // ── Pie ──
  // Va anclado abajo, no a continuación del contenido: es la advertencia que
  // define QUÉ es este documento, y tiene que estar donde siempre se busca.
  const yPie = 92;
  ctx.page.drawLine({
    start: { x: MARGEN, y: yPie + 34 },
    end: { x: DERECHA, y: yPie + 34 },
    thickness: 0.7,
    color: LINEA,
  });
  texto(
    ctx,
    "Este documento es un comprobante de pedido y NO constituye factura electrónica de venta.",
    MARGEN,
    yPie + 18,
    { size: 8.5, bold: true, color: GRIS },
  );
  texto(
    ctx,
    "Conserva este comprobante como soporte de tu compra. Ante cualquier duda escríbenos a " +
      snapshot.merchant.email,
    MARGEN,
    yPie + 6,
    { size: 8.5, color: GRIS },
  );

  return doc.save();
}

function lineasComprador(s: SalesDocumentSnapshot): string[] {
  const out: string[] = [];
  if (s.buyer.name) out.push(s.buyer.name);
  if (s.buyer.document) out.push(`Documento: ${s.buyer.document}`);
  if (s.buyer.email) out.push(s.buyer.email);
  if (s.buyer.phone) out.push(s.buyer.phone);
  return out.length > 0 ? out : ["Consumidor final"];
}

function lineasEnvio(s: SalesDocumentSnapshot): string[] {
  const e = s.shipping;
  if (!e) return [];
  const out: string[] = [];
  if (e.address) out.push([e.address, e.address2].filter(Boolean).join(", "));
  if (e.neighborhood) out.push(e.neighborhood);
  const ciudad = [e.city, e.state].filter(Boolean).join(", ");
  if (ciudad) out.push(ciudad);
  const pais = [nombrePais(e.country), e.zip].filter(Boolean).join(" ");
  if (pais) out.push(pais);
  if (e.notes) out.push(e.notes);
  return out;
}

/**
 * "CO" no es una dirección: es un código de base de datos impreso en un
 * documento que va a manos de una persona.
 */
function nombrePais(codigo: string | null): string | null {
  if (!codigo) return null;
  if (codigo === "CO") return "Colombia";
  if (codigo === "US") return "Estados Unidos";
  return codigo;
}

/** El nombre con el que el comprobante llega al correo y al disco. */
export function nombreArchivoComprobante(orderCode: string): string {
  return `comprobante-${orderCode}.pdf`;
}
