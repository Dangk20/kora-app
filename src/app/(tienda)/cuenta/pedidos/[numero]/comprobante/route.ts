// El comprobante de un pedido, para su comprador.
//
// El `customerId` va EN LA CONSULTA, no en una comprobación posterior: es la
// regla de todo el módulo de cuenta. Un pedido de otra persona no es un pedido
// al que se le niega el acceso — sencillamente no existe aquí.

import { currentBuyer } from "@/modules/buyer/session-cookie";
import { db } from "@/lib/db";
import { ensureSalesDocument } from "@/modules/invoicing/document";
import { nombreArchivoComprobante, renderSalesDocumentPdf } from "@/modules/invoicing/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ numero: string }> },
) {
  const buyer = await currentBuyer();
  if (!buyer) return new Response("No autorizado", { status: 403 });

  const { numero } = await params;
  const n = Number(numero);
  if (!Number.isInteger(n)) return new Response("No encontrado", { status: 404 });

  const pedido = await db.order.findFirst({
    where: { customerId: buyer.customerId, number: n },
    select: { id: true },
  });
  if (!pedido) return new Response("No encontrado", { status: 404 });

  const doc = await ensureSalesDocument(pedido.id);
  if (!doc) {
    return new Response("Este pedido no tiene comprobante: no está confirmado.", {
      status: 404,
    });
  }

  const pdf = await renderSalesDocumentPdf(doc.snapshot);
  const descargar = new URL(request.url).searchParams.has("descargar");
  const archivo = nombreArchivoComprobante(doc.snapshot.orderCode);

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${archivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
