// El comprobante de un pedido, para el panel.
//
// Se verifica contra la BASE con `requirePermission`, no contra el JWT: es la
// regla 4 del proyecto, y aplica igual a una ruta que a una acción — revocarle
// el acceso a alguien tiene que surtir efecto ya, no cuando caduque su sesión.

import { requirePermission } from "@/auth";
import { ensureSalesDocument } from "@/modules/invoicing/document";
import { nombreArchivoComprobante, renderSalesDocumentPdf } from "@/modules/invoicing/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("orders:view");
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const { id } = await params;
  const doc = await ensureSalesDocument(id);
  if (!doc) {
    // No es un error: un pedido pendiente, cancelado o expirado no vendió
    // nada, y un comprobante de una venta que no ocurrió es exactamente lo
    // que no puede existir.
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
      // Nunca en una caché compartida: lleva nombre, documento y dirección.
      "Cache-Control": "private, no-store",
    },
  });
}
