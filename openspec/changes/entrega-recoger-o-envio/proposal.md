## Why

**Alcance NUEVO, fuera de la cotización. Semana del plan: fuera de S1–S18 (petición de la consultoría de marketing, oct 2026). HU: no existe; modifica PED_HU001 §3** (el checkout pide siempre una dirección de envío).

La campaña del mes 1 se enfoca en el cliente local de Neiva, que puede comprar en la tienda física o en línea. Hoy el checkout **siempre** pide una dirección de entrega: quien vive en Neiva y quiere pasar por el pedido no tiene cómo decirlo, y el operador lo descubre en el chat de WhatsApp. Daniel lo pidió el 15 oct (bitácora) y lo precisó el 17 oct: **la primera pregunta del checkout es "¿Recoger en tienda o envío?"**, la opción de recoger dice **"SOLO EN NEIVA"**, y a partir de esa respuesta se despliega el resto del formulario.

## What Changes

- **El checkout arranca con una sola pregunta: ¿cómo quieres recibir tu pedido?** Dos opciones: *Recoger en tienda* (con la etiqueta **SOLO EN NEIVA**) y *Envío a domicilio*. Hasta responder, el resto del formulario no aparece y el botón de crear pedido no se activa.
- **Envío a domicilio:** el formulario de hoy, sin cambios (facturación + envío en Colombia + pago).
- **Recoger en tienda:** facturación + **quién recoge** + pago. No se pide dirección de entrega. Por omisión recoge quien paga (con pagador en Colombia); se puede indicar otra persona (nombre, celular +57 y documento opcional) — sirve también a quien compra desde EE.UU. y manda a un familiar.
- **La tienda física se muestra** con su dirección y horario: Calle 25 Sur # 32-23, Neiva, de 9:00 a. m. a 6:00 p. m. (confirmados por Daniel el 17 oct). El entorno los puede cambiar (`KORA_TIENDA_DIRECCION`, `KORA_TIENDA_HORARIO`); en blanco, el checkout dice que se confirman por WhatsApp — nunca un texto de relleno.
- **El pedido guarda el método de entrega** (`deliveryMethod`: `SHIPPING` | `PICKUP`). Con `PICKUP` los `ship*` guardan a quien recoge, con ciudad Neiva y sin dirección.
- **WhatsApp, comprobante, correos, panel y cuenta del comprador** dicen "Recoger en tienda" y quién recoge, en vez de una dirección.

## Capabilities

### New Capabilities
- `checkout-delivery`: cómo elige el comprador entre recoger y envío, qué pide cada camino, qué queda congelado en el pedido y cómo lo muestra cada consumidor.

### Modified Capabilities
- `checkout-addresses` (en `direccion-facturacion-y-envio`): el bloque de envío solo existe con método `SHIPPING`. El invariante "todo pedido nuevo lleva `shipCountry = CO`" se mantiene.

## Impact

- **Datos:** enum `DeliveryMethod` y columna `orders.deliveryMethod` con valor por omisión `SHIPPING` (todo pedido existente fue un envío: el backfill es el propio default).
- **Código:** `orders/checkout-actions.ts`, `orders/tienda-fisica.ts` (nuevo), `orders/message.ts`, `(tienda)/checkout/checkout-view.tsx`, `invoicing/snapshot.ts` + `pdf.ts`, `notifications/order-data.ts` + `render.ts`, `admin/pedidos/[id]`, `(tienda)/cuenta/pedidos/[numero]`, `buyer/orders.ts`, `messages/es|en/checkout.ts`.
- **Comprobante:** el snapshot gana `delivery` opcional; los comprobantes ya emitidos (sin el campo) se dibujan como envío, como se emitieron.

## Fuera de alcance

- Costo del domicilio en Neiva o tarifas por destino: no existe cobro de envío y no se introduce.
- Agendar franja de recogida, tiempo de preparación o aviso automático "listo para recoger" (no hay estado nuevo; el operador avisa por WhatsApp).
- Varias tiendas o puntos de recogida.
- Escribir la HU en Notion y en `hus-pedidos.md` (deuda documental, igual que el change de facturación).

## Bloqueos

Ninguno. Dirección y horario de la tienda confirmados por Daniel el 17 oct 2026.
