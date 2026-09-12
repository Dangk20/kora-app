## Decisions

**El consumo lo registra un driver, no cada módulo.** `createAccountingDriver`
envuelve al del proveedor y anota tras cada envío aceptado. Así el correo de
prueba de campaña —que hoy va directo al driver y no deja rastro— cuenta igual
que un pedido. En pruebas el orden es lista permitida → contable → proveedor:
lo que va a disco nunca pasa por el contable.

**Días y meses en UTC**, no en Bogotá. El proveedor corta por su reloj; el
nuestro es America/Bogota solo para el negocio.

**La firma se verifica a mano** (HMAC-SHA256 sobre `id.timestamp.cuerpo`,
comparación en tiempo constante) en vez de añadir la librería del proveedor:
son 30 líneas y una dependencia menos con acceso a la base.

**La idempotencia del webhook es el identificador de entrega** (`svix-id`),
único en la tabla. No el `email_id` + tipo, porque un mismo mensaje puede
abrirse varias veces y cada apertura es un evento distinto.

**Las métricas cuentan destinatarios distintos**, no eventos: tres aperturas
del mismo comprador son una apertura. Es lo que el operador entiende por
"cuántos abrieron".

**Rebote y queja pasan por `consent/suppression.ts`**, que ya existía para
esto. El webhook no escribe en `customers`.

**El borde exime `/api/webhooks/*` de la contraseña de pruebas** con dos
bloques `handle` en el Caddyfile: el proveedor no sabe contraseñas. `auth.caddy`
no cambia.

## Risks

- Los límites por defecto (100/día, 3.000/mes) se citan de memoria; Daniel los
  confirma en el panel del proveedor. Son configurables por eso.
- El rastreo de aperturas y clics hay que **activarlo en el dominio** desde el
  panel del proveedor; sin eso llegan entregas y rebotes pero no aperturas.
