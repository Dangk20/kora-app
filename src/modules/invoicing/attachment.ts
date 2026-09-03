// El comprobante, listo para viajar adjunto en el correo de confirmación.
//
// ⚠️ ESTA FUNCIÓN NO LANZA. Nunca. Si el comprobante no se puede generar
// devuelve `null` y deja constancia, y el correo sale sin adjunto.
//
// Es la misma regla que gobierna todo el módulo un nivel más abajo: crear un
// pedido no depende de que salga un correo, porque perder una venta por un
// correo caído es cambiar un problema pequeño por el peor. Aquí, perder el
// aviso de que un pago fue confirmado —el correo que el comprador está
// esperando— por culpa de un archivo adjunto sería exactamente ese mismo error.

import type { EmailAttachment } from "@/modules/email/driver";
import { ensureSalesDocument } from "./document";
import { nombreArchivoComprobante, renderSalesDocumentPdf } from "./pdf";

export async function comprobanteAdjunto(orderId: string): Promise<EmailAttachment | null> {
  try {
    const doc = await ensureSalesDocument(orderId);
    if (!doc) return null; // el pedido no está confirmado: no hay nada que adjuntar

    const pdf = await renderSalesDocumentPdf(doc.snapshot);
    return {
      filename: nombreArchivoComprobante(doc.snapshot.orderCode),
      content: pdf,
      contentType: "application/pdf",
    };
  } catch (e) {
    console.error(
      `[invoicing] no se pudo generar el comprobante del pedido ${orderId}; ` +
        "el correo sale sin adjunto:",
      e,
    );
    return null;
  }
}
