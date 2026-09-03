// El comprobante de pedido.
// Ver openspec/changes/comprobante-de-pedido — specs/sales-document.
//
// Lo que se defiende aquí son tres cosas que, si se rompen, NO DAN ERROR:
//   1. Un pedido confirmado sin comprobante. Se descubre el día que alguien lo
//      pide, que es siempre el peor día.
//   2. Un comprobante que cambia después de emitido. Un documento de respaldo
//      que se puede reescribir no respalda nada.
//   3. Un documento que dice ser una factura de venta sin serlo.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ensureSalesDocument, freezeSalesDocument } from "@/modules/invoicing/document";
import { buildSnapshot } from "@/modules/invoicing/snapshot";
import { renderSalesDocumentPdf } from "@/modules/invoicing/pdf";

const PREFIJO = "zzt-comprobante";

async function pedido(status: "PENDING" | "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
  return db.order.create({
    data: {
      channel: "WEB",
      status,
      currency: "COP",
      subtotal: 100_000,
      total: 100_000,
      contactName: "Nombre original",
      shipAddress: "Dirección original",
      shipCity: "Neiva",
      note: PREFIJO,
      confirmedAt: status === "CONFIRMED" ? new Date("2026-08-15T15:00:00Z") : null,
    },
  });
}

async function limpiar() {
  const ids = (
    await db.order.findMany({ where: { note: PREFIJO }, select: { id: true } })
  ).map((o) => o.id);
  if (ids.length === 0) return;
  await db.salesDocument.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(limpiar);
afterEach(limpiar);

describe("un pedido confirmado emite exactamente un comprobante", () => {
  it("lo emite con la fecha que se le pasa", async () => {
    const o = await pedido();
    const fecha = new Date("2026-08-15T15:00:00Z");
    await db.$transaction((tx) => freezeSalesDocument(tx, o.id, fecha));

    const doc = await db.salesDocument.findUnique({ where: { orderId: o.id } });
    expect(doc).not.toBeNull();
    expect(doc!.number).toBe(o.number);
    expect(doc!.issuedAt.toISOString()).toBe(fecha.toISOString());
  });

  it("congelarlo dos veces no crea un segundo, y conserva la fecha del PRIMERO", async () => {
    // Confirmar dos veces es un doble clic del operador. El comprobante bueno
    // es el primero: el segundo tendría una fecha que no es la de la venta.
    const o = await pedido();
    const primera = new Date("2026-08-15T15:00:00Z");
    const segunda = new Date("2026-08-20T10:00:00Z");

    await db.$transaction((tx) => freezeSalesDocument(tx, o.id, primera));
    await db.$transaction((tx) => freezeSalesDocument(tx, o.id, segunda));

    const docs = await db.salesDocument.findMany({ where: { orderId: o.id } });
    expect(docs).toHaveLength(1);
    expect(docs[0].issuedAt.toISOString()).toBe(primera.toISOString());
  });

  it("una transacción revertida no deja comprobante", async () => {
    // Si el stock no alcanza, la confirmación entera se deshace. Un comprobante
    // superviviente sería la constancia de una venta que no ocurrió.
    const o = await pedido();
    await expect(
      db.$transaction(async (tx) => {
        await freezeSalesDocument(tx, o.id, new Date());
        throw new Error("stock insuficiente, por ejemplo");
      }),
    ).rejects.toThrow();

    expect(await db.salesDocument.findUnique({ where: { orderId: o.id } })).toBeNull();
  });
});

describe("el comprobante queda congelado", () => {
  it("no cambia aunque cambien los datos del pedido después", async () => {
    const o = await pedido();
    await db.$transaction((tx) => freezeSalesDocument(tx, o.id, new Date()));

    await db.order.update({
      where: { id: o.id },
      data: { contactName: "Nombre cambiado", shipAddress: "Dirección cambiada" },
    });

    const doc = await db.salesDocument.findUnique({ where: { orderId: o.id } });
    const snap = doc!.snapshot as unknown as ReturnType<typeof buildSnapshot>;
    expect(snap.buyer.name).toBe("Nombre original");
    expect(snap.shipping?.address).toBe("Dirección original");
  });

  it("los datos del comerciante se copian, no se leen al renderizar", async () => {
    const o = await pedido();
    await db.$transaction((tx) => freezeSalesDocument(tx, o.id, new Date()));

    const doc = await db.salesDocument.findUnique({ where: { orderId: o.id } });
    const snap = doc!.snapshot as unknown as ReturnType<typeof buildSnapshot>;
    expect(snap.merchant.razonSocial).toBeTruthy();
    expect(snap.merchant.nit).toBeTruthy();
  });
});

describe("solo las ventas tienen comprobante", () => {
  it("un pedido pendiente no lo tiene, y pedirlo no lo crea", async () => {
    const o = await pedido("PENDING");
    expect(await ensureSalesDocument(o.id)).toBeNull();
    expect(await db.salesDocument.findUnique({ where: { orderId: o.id } })).toBeNull();
  });

  it("un pedido cancelado tampoco", async () => {
    const o = await pedido("CANCELLED");
    expect(await ensureSalesDocument(o.id)).toBeNull();
  });

  it("un pedido confirmado ANTES de este módulo lo emite al pedirlo, con su fecha real", async () => {
    // No se rellenó hacia atrás en el despliegue a propósito. El documento
    // tiene que decir cuándo se vendió, no cuándo alguien lo pidió.
    const o = await pedido();
    const doc = await ensureSalesDocument(o.id);
    expect(doc).not.toBeNull();
    expect(doc!.issuedAt.toISOString()).toBe(o.confirmedAt!.toISOString());
  });
});

describe("el código del pedido se congela, no se recalcula", () => {
  it("usa el año de CREACIÓN, no el de confirmación", () => {
    // Un pedido creado el 31 de diciembre y confirmado el 1 de enero se
    // enseñaría en el panel con un año y en su comprobante con otro: dos
    // códigos para una misma compra, sin que ninguna pantalla fallara.
    const snap = buildSnapshot(
      {
        number: 42,
        createdAt: new Date("2026-12-31T20:00:00Z"),
        currency: "COP",
        channel: "WEB",
        subtotal: { toString: () => "1000" },
        discountTotal: { toString: () => "0" },
        cashbackApplied: { toString: () => "0" },
        total: { toString: () => "1000" },
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        contactDocument: null,
        shipCountry: null,
        shipState: null,
        shipCity: null,
        shipAddress: null,
        shipAddress2: null,
        shipNeighborhood: null,
        shipZip: null,
        shipNotes: null,
        paymentPreference: null,
        note: null,
        items: [],
      },
      new Date("2027-01-02T10:00:00Z"),
    );
    expect(snap.orderCode).toBe("KO-2026-00042");
  });
});

describe("el documento dice lo que es", () => {
  const pdf = readFileSync("src/modules/invoicing/pdf.ts", "utf8");

  it("se titula comprobante y niega ser factura electrónica", () => {
    expect(pdf).toContain("COMPROBANTE DE PEDIDO");
    expect(pdf).toContain("NO constituye factura electrónica de venta");
  });

  it("no desglosa IVA", () => {
    // El sistema no tiene ni una tarifa cargada. Un desglose calculado sobre
    // una tarifa supuesta no es un dato incompleto: es un dato falso con
    // apariencia de dato, y a diferencia de un campo vacío nadie lo revisa.
    expect(pdf).not.toMatch(/\bIVA\b/);
    expect(pdf).not.toMatch(/base gravable/i);
  });

  it("no se llama a sí mismo factura de venta en ninguna parte", () => {
    expect(pdf).not.toMatch(/["`']Factura de [Vv]enta/);
  });
});

describe("el comprobante se emite dentro de la transacción que confirma", () => {
  it("todo archivo que confirme un pedido congela su comprobante", () => {
    // Hoy `confirmOrder()` es el único camino a CONFIRMED, pero el POS (S9) va
    // a abrir otro. Un pedido confirmado sin comprobante no da ningún error:
    // se descubre el día que alguien lo pide.
    const archivos = [
      "src/modules/orders/actions.ts",
      "src/modules/orders/checkout-actions.ts",
    ];
    for (const ruta of archivos) {
      const fuente = readFileSync(ruta, "utf8");
      if (!fuente.includes('status: "CONFIRMED"')) continue;
      expect(fuente, `${ruta} confirma pedidos y tiene que congelar el comprobante`).toContain(
        "freezeSalesDocument",
      );
    }
  });

  it("el instante de la confirmación es UNO solo", () => {
    // `confirmedAt`, el evento y el comprobante tienen que llevar la MISMA
    // marca de tiempo, no tres `new Date()` separados por microsegundos.
    const fuente = readFileSync("src/modules/orders/actions.ts", "utf8");
    expect(fuente).toContain("const ahora = new Date()");
    expect(fuente).toContain("confirmedAt: ahora");
    expect(fuente).toContain("freezeSalesDocument(tx, orderId, ahora)");
  });
});

describe("un adjunto nunca impide que salga el correo", () => {
  it("el generador del adjunto no lanza: devuelve null", () => {
    const fuente = readFileSync("src/modules/invoicing/attachment.ts", "utf8");
    expect(fuente).toContain("catch");
    expect(fuente).toContain("return null");
  });

  it("solo viaja con la confirmación, no con cada cambio de estado", () => {
    // Adjuntarlo a "en preparación" y "entregado" mandaría el mismo documento
    // cuatro veces y el comprador tendría que adivinar cuál es el bueno.
    const fuente = readFileSync("src/modules/events/handlers/order-emails.ts", "utf8");
    expect(fuente).toContain('type === "BUYER_CONFIRMED" ? await comprobanteAdjunto');
  });
});

describe("nadie ve el comprobante de otro", () => {
  it("la ruta del comprador filtra por su identificador EN LA CONSULTA", () => {
    // No en una comprobación posterior: es la regla de todo el módulo de
    // cuenta. Un pedido de otra persona no existe aquí.
    const ruta = readFileSync(
      "src/app/(tienda)/cuenta/pedidos/[numero]/comprobante/route.ts",
      "utf8",
    );
    expect(ruta).toContain("where: { customerId: buyer.customerId, number: n }");
  });

  it("la ruta del panel verifica el permiso contra la base", () => {
    const ruta = readFileSync("src/app/admin/pedidos/[id]/comprobante/route.ts", "utf8");
    expect(ruta).toContain('requirePermission("orders:view")');
  });

  it("ninguna de las dos deja el PDF en una caché compartida", () => {
    for (const r of [
      "src/app/admin/pedidos/[id]/comprobante/route.ts",
      "src/app/(tienda)/cuenta/pedidos/[numero]/comprobante/route.ts",
    ]) {
      expect(readFileSync(r, "utf8")).toContain("private, no-store");
    }
  });
});

describe("el PDF se genera de verdad", () => {
  it("produce un PDF válido y no vacío", async () => {
    const o = await pedido();
    const doc = await ensureSalesDocument(o.id);
    const bytes = await renderSalesDocumentPdf(doc!.snapshot);

    expect(bytes.length).toBeGreaterThan(3000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("un nombre de producto con caracteres raros no lo tumba", async () => {
    // Los nombres los carga el cliente desde su Excel. Helvetica codifica
    // WinAnsi, y un carácter fuera de ese juego hace LANZAR a pdf-lib: un solo
    // "★" tumbaría el comprobante y, con él, el correo de confirmación.
    const o = await pedido();
    const doc = await ensureSalesDocument(o.id);
    const conRareza = {
      ...doc!.snapshot,
      lines: [
        {
          sku: "RARO-1",
          productName: "Camiseta ★ edición 「especial」 — 100% algodón ✓",
          variantName: "Talla M · Azul",
          qty: 1,
          unitPrice: "50000",
          total: "50000",
        },
      ],
    };
    await expect(renderSalesDocumentPdf(conRareza)).resolves.toBeInstanceOf(Uint8Array);
  });
});
