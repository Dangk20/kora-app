// Escribe un comprobante de ejemplo en .invoices/ para poder MIRARLO.
//
// Mismo motivo que `pnpm emails:preview`: el cliente tiene que aprobar el
// documento antes de que salga hacia un comprador de verdad, y un PDF no se
// revisa leyendo el código que lo dibuja.
//
//   pnpm invoice:preview              → un pedido de ejemplo, inventado
//   pnpm invoice:preview KO-2026-7943 → el comprobante real de ese pedido
//   pnpm invoice:preview 7943         → igual

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { ensureSalesDocument } from "../src/modules/invoicing/document";
import { nombreArchivoComprobante, renderSalesDocumentPdf } from "../src/modules/invoicing/pdf";
import { buildSnapshot } from "../src/modules/invoicing/snapshot";
import type { SalesDocumentSnapshot } from "../src/modules/invoicing/snapshot";

const DESTINO = join(process.cwd(), ".invoices");

async function snapshotDeEjemplo(): Promise<SalesDocumentSnapshot> {
  return buildSnapshot(
    {
      number: 7943,
      createdAt: new Date(),
      currency: "COP",
      channel: "WEB",
      subtotal: { toString: () => "489000" },
      discountTotal: { toString: () => "24450" },
      cashbackApplied: { toString: () => "12000" },
      total: { toString: () => "452550" },
      contactName: "María José Cruz Romero",
      contactPhone: "+573229898711",
      contactEmail: "mjcruzr29@ejemplo.com",
      contactDocument: "1000376141",
      shipCountry: "CO",
      shipState: "Huila",
      shipCity: "Neiva",
      shipAddress: "Calle 21 # 5-45",
      shipAddress2: "Apto 302",
      shipNeighborhood: "Altico",
      shipZip: null,
      shipNotes: "Portería recibe hasta las 6 p. m.",
      paymentPreference: "Nequi",
      note: null,
      items: [
        {
          sku: "CAM-POLO-M-AZU",
          productName: "Camiseta Polo clásica",
          variantName: "Talla M · Azul",
          qty: 2,
          unitPrice: { toString: () => "89000" },
          total: { toString: () => "178000" },
        },
        {
          sku: "TEN-RUN-42",
          productName: "Tenis de running Ultralight",
          variantName: "Talla 42",
          qty: 1,
          unitPrice: { toString: () => "311000" },
          total: { toString: () => "311000" },
        },
      ],
    },
    new Date(),
  );
}

async function main() {
  const arg = process.argv[2]?.replace(/^KO-\d{4}-/i, "").replace(/^KO-/i, "");
  await mkdir(DESTINO, { recursive: true });

  let snapshot: SalesDocumentSnapshot;
  let etiqueta: string;

  if (arg) {
    const numero = Number(arg);
    if (!Number.isFinite(numero)) {
      console.error("Número de pedido no válido.");
      process.exit(1);
    }
    const pedido = await db.order.findFirst({ where: { number: numero }, select: { id: true } });
    if (!pedido) {
      console.error(`No existe el pedido ${numero}.`);
      process.exit(1);
    }
    const doc = await ensureSalesDocument(pedido.id);
    if (!doc) {
      console.error(`El pedido ${numero} no está confirmado: no tiene comprobante.`);
      process.exit(1);
    }
    snapshot = doc.snapshot;
    etiqueta = `pedido real ${numero}`;
  } else {
    snapshot = await snapshotDeEjemplo();
    etiqueta = "pedido de ejemplo";
  }

  const pdf = await renderSalesDocumentPdf(snapshot);
  const ruta = join(DESTINO, nombreArchivoComprobante(snapshot.orderCode));
  await writeFile(ruta, pdf);

  console.log(`✔ Comprobante escrito (${etiqueta}):`);
  console.log(`  ${ruta}`);
  if (snapshot.merchant.nit.startsWith("[")) {
    console.log("");
    console.log("⚠ Los datos del comerciante son marcadores: falta configurar KORA_LEGAL_*.");
    console.log("  En producción la aplicación no arrancaría así.");
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
