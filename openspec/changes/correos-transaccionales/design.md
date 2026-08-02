# Diseño — Correos transaccionales

## Context

Motivación y la advertencia de alcance, en `proposal.md`. Requisitos en `specs/`.

**Lo que ya existe y hace esto corto:**

- **La entrega** (`modules/email/`): interfaz de dos drivers —a disco en desarrollo, proveedor en producción—, remitente configurado y guarda de arranque que impide arrancar en producción sin proveedor.
- **La plantilla de marca** con su versión de texto plano.
- **La bandeja de salida y su worker**: reintentos crecientes, muerte terminal, recuperación de huérfanos y diagnóstico. Ya la usan el cashback y el registro de pedido.
- **`Setting`**, que ya guarda el número de WhatsApp de la tienda.
- **`emailUsable`** en el cliente, que ya marca las direcciones que rebotaron.

**Lo que falta:** qué se manda, cuándo, y que no se mande dos veces.

## Goals / Non-Goals

**Goals**

- Que el comprador tenga su comprobante y su camino de vuelta a WhatsApp.
- Que el operador se entere del pedido dentro de las dos horas que vive.
- Que un correo caído no cueste una venta.

**Non-Goals**

- Verificación de correo, recuperación de contraseña, avisos de stock, WhatsApp automatizado.

## Decisions

### 1. Todo sale por la bandeja de salida, nunca desde la acción

**Decisión:** `createOrder()` escribe `order.created` en `domain_events` **dentro de su transacción**; los cambios de estado escriben el suyo. El worker envía.

**Por qué:** enviar dentro de la acción ataría la venta a que un tercero responda. Un proveedor lento convertiría el checkout en una espera; uno caído, en un error — y perder la venta porque no salió el correo es cambiar un problema pequeño por el peor de todos.

Con la bandeja, el pedido y su intención de aviso se escriben **juntos o ninguno**, y el envío ocurre después con reintentos. Es la misma decisión que ya rige el cashback, y aquí es más barata: el correo tolera minutos de retraso.

**Coste aceptado:** el correo llega segundos después, no en el mismo instante. Irrelevante para un comprobante.

### 2. El registro de envío se escribe ANTES de entregar al proveedor

**Decisión:** tabla con índice único por (pedido, tipo). Se inserta primero; si la inserción choca, otro ya se encargó y no se hace nada. Solo entonces se entrega al proveedor.

**Por qué:** es la misma disyuntiva que ya se resolvió en las campañas. Si se enviara primero y se registrara después, un fallo entre medias haría que el reintento **vuelva a enviar**. Reservando antes, el peor caso es que alguien no reciba un correo — molesto — en vez de recibirlo dos veces, que es lo que hace que el operador empiece a ignorar los avisos.

**La garantía la da el índice, no la comprobación previa:** dos trabajadores pueden mirar a la vez y ver ambos que no está. Leer no es reservar.

### 3. Dos motivos de exclusión, no uno

**Decisión:** `acceptsMarketing` frena solo campañas; `emailUsable = false` frena todo.

**Por qué:** hoy el sistema tiene una sola idea de "no enviar" y son dos cosas distintas. *"No me mandes promociones"* no es *"aquí no vive nadie"*. Con una sola lista, o le niegas la factura a quien solo rechazó publicidad, o sigues escribiendo a buzones muertos — y lo segundo es lo que hunde la reputación del dominio y hace que deje de llegar el correo de todos los demás.

### 4. El destinatario del comprador es el del PEDIDO, no el del cliente

**Decisión:** se escribe a `contactEmail` del pedido.

**Por qué:** el pedido guarda su propio snapshot del comprador a propósito — si el cliente cambia de correo después, el pedido despachado conserva el suyo. El correo pertenece a ese pedido, no a la ficha del cliente en su estado de hoy.

La comprobación de dirección utilizable sí va contra el cliente, porque es una propiedad de la dirección.

### 5. La dirección del operador es un ajuste, no una variable de entorno

**Decisión:** clave en `Setting`, como el número de WhatsApp.

**Por qué:** cambiarla es una decisión del negocio, no un despliegue. El día que el operador cambie o quieran que llegue a dos personas, no puede depender de nosotros.

**Sin configurar no falla:** se registra el motivo y el pedido sigue. Pero **queda constancia**, porque un negocio que no recibe avisos tiene que poder enterarse de por qué.

### 6. Una plantilla, dos usos

**Decisión:** el generador de la plantilla admite pedido —líneas, totales, botón— y omite el pie de baja cuando el correo es transaccional.

**Por qué:** dos generadores se desincronizan, y lo que el cliente aprueba visualmente tiene que ser lo que sale. El pie de baja se omite porque ofrecer "date de baja" en un comprobante promete algo que no se va a cumplir —el siguiente pedido generará su correo igual— y además marca el mensaje como comercial ante los filtros.

### 7. Los eventos nuevos son del pedido, no del correo

**Decisión:** `order.created`, `order.shipped`, `order.cancelled` — no `email.send`.

**Por qué:** un evento describe **lo que pasó en el negocio**, no lo que se quiere hacer con ello. Con `order.shipped` puede colgar mañana un aviso por WhatsApp o una métrica sin tocar quien lo emite; con `email.send`, el emisor ya habría decidido por todos.

## Dónde vive cada cosa

```
src/modules/notifications/
  types.ts       los tipos de correo y a quién van
  guard.ts       a quién SÍ se le puede escribir (las dos listas)
  settings.ts    la dirección del negocio
  render.ts      qué dice cada correo
  send.ts        reservar, enviar y registrar
src/modules/events/handlers/
  order-created-emails.ts · order-confirmed-email.ts · order-status-email.ts
tests/notifications.test.ts
```

**Migración:** tabla del registro de envíos, con índice único (pedido, tipo).

**Eventos nuevos:** `order.created`, `order.shipped`, `order.cancelled`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Enviar dos veces.** El operador que recibe dos avisos deja de mirarlos. | Reserva antes de enviar, con índice único. Fijado por prueba, incluida la de dos procesos a la vez. |
| **El correo rompe la venta.** | Nada se envía dentro de la transacción del pedido. Fijado por prueba: con el driver fallando, el pedido se crea igual. |
| **Los correos no salen y nadie se entera** mientras el dominio no tenga sus registros. | Los eventos se acumulan visibles en el diagnóstico de la bandeja, como ya pasa. `outbox:status` avisa si se atascan. |
| **El cliente aprueba una plantilla que luego se ve distinta.** | Un solo generador, y en desarrollo el correo se escribe a disco: se abre y se lee tal cual saldrá. |
| **Un pedido sin correo** (creado desde el POS, por ejemplo) haría fallar el manejador. | No es un error: se registra el motivo y se sigue. Lo mismo con la dirección del negocio sin configurar. |

## Migration Plan

1. Tabla del registro y ajuste de la dirección del negocio.
2. El guard de las dos listas, **con sus pruebas**: es la regla que más fácil se rompe.
3. Contenido y envío, con la reserva previa.
4. Emitir los eventos nuevos desde el pedido.
5. Registrar los manejadores en el worker.

**Reversión:** desregistrar los manejadores detiene los correos sin tocar los pedidos. Los eventos quedan en la bandeja.

## Open Questions

- **¿Quiere el cliente un correo cuando el pedido pasa a "en preparación"?** Se asume que no: son cuatro avisos y añadir uno más por cada estado intermedio cansa al comprador. Fácil de añadir si lo pide.
- **¿A cuántas direcciones debe llegar el aviso de pedido nuevo?** Se construye para una. Varias es un cambio pequeño, pero conviene saber si lo necesitan antes de inventarlo.
