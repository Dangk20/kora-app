# Correos transaccionales del pedido

**Semana del plan:** ninguna. No estaba planificado.

**HUs:** **no existen, y el alcance tampoco lo pide.** Ver más abajo.

## ⚠️ Esto es ALCANCE NUEVO, y hay que decirlo antes de construirlo

El alcance firmado, §6, dice exactamente:

> *"**Email remarketing** — Campañas de email masivo a la base de clientes. Envío de promociones según lo que el negocio quiera impulsar."*

Eso es lo que se construyó en S13. **Los correos transaccionales —confirmación al comprador, aviso al operador— no aparecen en el alcance ni en la cotización.** Se construyen porque Daniel los pidió el 1 ago 2026 como requisito del bloque "KORA Tienda Online v1", y porque una tienda sin ellos se siente rota. Si se cobran, se negocian o se absorben es una decisión comercial que queda fuera de este documento; lo que no puede pasar es que se entreguen como si siempre hubieran estado incluidos.

Queda pendiente escribir las HUs.

## Why

**El comprador hace un pedido y no recibe nada.** Se le muestra una pantalla de éxito y un enlace a WhatsApp; si lo cierra, no le queda constancia de nada: ni el número del pedido, ni qué compró, ni cómo retomar el pago. En una tienda donde **el cobro ocurre fuera de la plataforma**, ese correo no es cortesía: es el comprobante y el único camino de vuelta.

**Y el operador no se entera de que vendió.** Hoy tiene que abrir el panel a mirar. Un pedido pendiente vive **2 horas** antes de expirar: si nadie lo ve, la venta se cae sola.

**Se puede construir ya y es corto.** La infraestructura de S13 sirve tal cual: interfaz de dos drivers —a disco en desarrollo, proveedor en producción—, plantilla de marca, guarda de arranque. Lo que falta es qué se manda y cuándo.

## What Changes

- **Al comprador:** pedido recibido (con su resumen y el enlace de WhatsApp), pedido confirmado (con el cashback acreditado), pedido enviado, y pedido cancelado o expirado.
- **Al operador:** aviso de pedido nuevo, con el enlace directo al pedido en el panel.
- **La dirección del operador es configurable**, como ya lo es el número de WhatsApp de la tienda.
- **`order.created` pasa a ser un evento de dominio**, escrito en la misma transacción que el pedido. Hoy solo existe `order.confirmed`.
- **Un registro de qué se envió**, para que un reintento no mande dos veces el mismo correo.

## La regla que define el diseño: transaccional ≠ marketing

Un correo transaccional **NO obedece la baja de marketing**. Quien se dio de baja de promociones sigue recibiendo la confirmación de su compra: es un mensaje de servicio, no publicidad, y negárselo lo dejaría sin comprobante de algo que pagó.

Pero **sí obedece la supresión por rebote**: si la dirección no existe, seguir escribiéndole solo daña la reputación del dominio y el correo no llega igual.

Son dos listas distintas y hasta hoy el sistema tenía una sola. Confundirlas rompe en las dos direcciones: o le mandas promociones a quien las rechazó, o le niegas su factura a quien solo rechazó promociones.

## Capabilities

### New Capabilities

- `transactional-email`: qué correo sale en cada momento del pedido, a quién, y por qué nunca sale dos veces.

### Modified Capabilities

- `email-consent`: hay que distinguir la baja de marketing de la supresión de la dirección. Hoy la capacidad publicada trata la lista como una sola.

## Fuera de alcance

- **Verificación del correo al crear cuenta** y **recuperación de contraseña.** La segunda está bloqueada por los registros del dominio y la primera cambia el flujo de registro; van en su propio change.
- **Notificaciones de stock bajo al operador.** Útil, pero no es del pedido y nadie la ha pedido.
- **La ruta que recibe los avisos del proveedor** (rebotes, quejas). Sigue sin construirse: su contrato de firma no se puede verificar sin la cuenta.
- **Notificaciones por WhatsApp.** El cobro ya ocurre ahí; automatizar mensajes exige la API de negocio, que no está contratada.

## Bloqueos declarados

**El envío real sigue bloqueado**, igual que las campañas: `korashopp.com` no tiene SPF, DKIM ni DMARC, y no hay cuenta de proveedor. Insumo pendiente del cliente desde el 31 jul.

**Qué se puede entregar igual:** todo, funcionando y verificable. En desarrollo el correo se escribe a disco (`.emails/`) y se abre en el navegador, así que el cliente puede **ver y aprobar cada plantilla** antes de que exista el dominio. Activar el envío es configuración, no desarrollo.

## Impact

**Archivos nuevos**
- `src/modules/notifications/` — qué se manda, a quién y el registro de lo enviado
- Manejadores de la bandeja de salida para cada momento del pedido
- `tests/notifications.test.ts`

**Archivos modificados**
- `prisma/schema.prisma` + migración — el registro de envíos
- `src/modules/orders/checkout-actions.ts` — emitir `order.created`
- `src/modules/orders/actions.ts` — emitir los eventos de cambio de estado
- `src/modules/email/template.ts` — una plantilla transaccional junto a la de campaña
- `src/modules/consent/` — separar baja de marketing de supresión de dirección

**Reglas del proyecto que este change NO puede violar**
- **El correo NO puede romper la venta.** Si el proveedor está caído, `createOrder()` y `confirmOrder()` tienen que seguir funcionando: el envío cuelga de la bandeja de salida, nunca del camino crítico.
- **Todo manejador es idempotente.** La entrega es *al menos una vez*.
- **Las monedas no se mezclan** en los importes del correo.

**Riesgo principal**
Mandar el mismo correo dos veces. Es menos grave que duplicar dinero, pero es lo que hace que un comprador deje de confiar en los avisos de una tienda — y el operador que recibe dos veces "pedido nuevo" acaba ignorándolos. Se fija con prueba y con un índice único, no con una comprobación optimista.
