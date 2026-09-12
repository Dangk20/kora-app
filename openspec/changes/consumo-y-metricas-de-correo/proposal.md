## Why

Email marketing queda abierto en pruebas con el plan gratuito del proveedor,
que limita los envíos por día y por mes. Hoy nadie ve cuánto se ha consumido:
una campaña que supere el cupo falla a mitad, el módulo reintenta al día
siguiente, y el operador no sabe por qué la mitad no salió. Daniel necesita ese
contador **mientras decide el plan con el cliente**.

Y las métricas de campaña —entregas, aperturas, clics, rebotes— siguen diciendo
"no disponibles" cuando el proveedor ya puede reportarlas por webhook. Peor:
con el proveedor configurado en pruebas, el aviso de "no disponibles"
desaparece y **no aparece nada en su lugar**.

## What Changes

- **Contador de consumo del proveedor.** Cada correo que sale por el proveedor
  deja constancia en un registro propio; de ahí salen "hoy N de X" y "este mes
  N de Y", con límites configurables y los del plan gratuito por defecto. El
  proveedor no expone su contador (la clave es de solo envío), así que lo
  llevamos nosotros — exacto mientras todo pase por KORA, que es el caso.
- **Aviso antes de enviar una campaña** cuya audiencia no cabe en lo que queda:
  si no cabe en el **mes**, no arranca; si no cabe en el **día**, avisa y deja
  decidir, porque el módulo drena en los días siguientes.
- **Endpoint de webhooks del proveedor**, con firma verificada, que registra
  cada evento (entregado, abierto, clic, rebote, queja, retraso) y **alimenta la
  supresión** que ya existe: un rebote duro marca la dirección como no
  utilizable; una queja de spam da de baja.
- **Métricas de campaña reales** cruzando esos eventos con los destinatarios,
  y "no disponibles" **solo** cuando el webhook no está configurado —con ese
  motivo, no el de antes.

## Capabilities

### New Capabilities
- `email-usage`: cuánto correo ha salido por el proveedor, contra qué límite, y
  qué pasa cuando una campaña no cabe.
- `email-provider-events`: cómo entran los eventos del proveedor, cómo se
  verifica que son suyos, y qué efectos tienen.

### Modified Capabilities
- `email-campaigns`: el requisito de reporte pasa a mostrar métricas reales
  cuando hay eventos, y "no disponibles" solo cuando falta el webhook.

## Impact

- Esquema: `provider_sends` (registro de consumo) y `email_events` (eventos del
  proveedor). Migración.
- `src/modules/email/`: driver contable; `usage.ts`; `webhook.ts` (firma).
- Ruta `POST /api/webhooks/resend`.
- `campaigns/`: comprobación de cupo al enviar; métricas desde eventos.
- Panel: barra de consumo en Campañas; métricas en el detalle.
- Borde: `/api/webhooks/*` exento de la contraseña de pruebas (Caddyfile).
- Variables: `KORA_EMAIL_DAILY_LIMIT`, `KORA_EMAIL_MONTHLY_LIMIT`,
  `RESEND_WEBHOOK_SECRET`.
