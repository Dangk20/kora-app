// Entrada de los eventos del proveedor de correo.
// Ver openspec/changes/consumo-y-metricas-de-correo — specs/email-provider-events.
//
// Público por necesidad: el proveedor no sabe contraseñas (en pruebas, el
// borde exime esta ruta de la del entorno). La firma es lo único que separa
// al proveedor de cualquiera — y un rebote falso da de baja una dirección.

import { recordProviderEvent, type ProviderEvent } from "@/modules/email/events";
import { verifyWebhook, webhookSecret } from "@/modules/email/webhook";

export async function POST(request: Request) {
  // El cuerpo se lee CRUDO: la firma cubre los bytes exactos, y volver a
  // serializar un JSON cambia espacios y orden.
  const body = await request.text();
  const v = verifyWebhook({
    secret: webhookSecret(),
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });

  if (!v.ok) {
    if (v.reason === "sin-secreto") {
      return new Response("Webhook no configurado: falta RESEND_WEBHOOK_SECRET.", { status: 503 });
    }
    return new Response("Firma inválida.", { status: 401 });
  }

  let event: ProviderEvent;
  try {
    event = JSON.parse(body) as ProviderEvent;
  } catch {
    return new Response("Cuerpo no es JSON.", { status: 400 });
  }

  const r = await recordProviderEvent(request.headers.get("svix-id")!, event);
  // 200 también al duplicado: si no, el proveedor reintentaría para siempre.
  return Response.json({ ok: true, duplicate: r.duplicate, effect: r.effect });
}
