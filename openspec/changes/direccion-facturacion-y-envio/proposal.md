## Why

**Modifica PED_HU001 §3 y es alcance NUEVO fuera de la cotización.** PED_HU001 asume que el formulario en USD es un formulario de EE.UU. *entero*: contacto en EE.UU. y **entrega en EE.UU.** (street address, state, ZIP). En la reunión de aprobación del 13 sep 2026 el cliente aclaró que **KORA no hace envíos a Estados Unidos**: el caso de uso en USD es *una persona en EE.UU. compra y se lo manda a un familiar en Colombia*. Hoy el checkout pide **una sola dirección** (`ship*`) y, en la tienda en USD, la pide en EE.UU. — está al revés del negocio real, y un pedido en USD creado hoy lleva una dirección de entrega a la que nadie va a enviar nada. Ninguna HU escrita contempla dos direcciones; se declara como alcance nuevo, igual que la libreta y el comprobante.

Lo que pidió el cliente, en sus términos: **dirección de facturación** (datos y dirección de quien paga: en EE.UU. en ese caso) y **dirección de envío** (la del familiar en Colombia). Pueden ser iguales o distintas; al llegar al envío se pregunta "¿es la misma?" y, si dice que sí, se precarga sin volver a escribir.

**Decisión que este change fija** (dictada por Daniel el 13 sep a partir de lo que dijo el cliente): **la dirección de envío es SIEMPRE en Colombia.** Lo que puede ser Colombia o EE.UU. es quién paga. Un formulario de envío a EE.UU. que el negocio no atiende no es una opción "por si acaso": es un pedido que se crea y nunca se despacha.

## What Changes

- **El checkout pasa a tener dos bloques de dirección**: *Datos de facturación* (contacto + dirección de quien paga, país CO o US) y *Datos de envío* (destinatario + dirección en Colombia). Hoy hay un solo bloque, "Dirección de entrega", que además hace de facturación sin decirlo.
- **El país del checkout deja de decidir la entrega y pasa a decidir la facturación.** Sigue arrancando desde la moneda (COP → Colombia, USD → EE.UU.), como dice PED_HU001 §1, pero lo que gobierna es el bloque de quien paga: prefijo telefónico, documento, métodos de pago y campos de dirección. El bloque de envío es el formulario colombiano siempre (departamento DANE, municipio cerrado, barrio).
- **"Usar los mismos datos de facturación"** cuando el pagador está en Colombia: marcada por omisión, **precarga** los datos de envío con los de facturación; los campos siguen visibles y editables, y editarlos desmarca la casilla. Si el pagador está en EE.UU. la casilla no aparece: la entrega no puede ser la misma.
- **El correo del pedido es el de facturación**: el bloque de envío no pide correo, así que un regalo no se anuncia al destinatario. La dirección de facturación no va al chat de WhatsApp; es dato del panel, del comprobante y de una futura pasarela.
- **El destinatario tiene sus propios datos de contacto**: nombre y celular colombiano (+57), porque la transportadora llama a quien recibe, no a quien pagó desde Miami. Documento del destinatario **opcional**: quien compra desde fuera no siempre tiene la cédula del familiar a mano, y exigirla perdería la venta.
- **El pedido guarda las dos** como snapshot inmutable: los `contact*` + `bill*` (facturación) y los `ship*` + `shipName`/`shipPhone`/`shipDocument` (envío). **BREAKING para los consumidores del snapshot**: comprobante, correos, mensaje de WhatsApp, panel de pedidos y cuenta del comprador muestran hoy "una dirección" y pasan a distinguir las dos.
- **La libreta de direcciones se vuelve libreta de ENVÍO** (direcciones en Colombia: "Casa de mamá en Cali"). Las direcciones de facturación no van a la libreta: la de quien paga se precarga desde su último pedido, sin crear un segundo escritor del espejo `customer.city`/`address`.
- **El comprobante de pedido** muestra *Facturado a* y *Enviado a* como bloques separados, y el comprobante congela las dos.
- **El mensaje de WhatsApp** al operador dice quién paga y a quién se le envía, para que no tenga que preguntarlo en el chat: es la razón de ser de PED_HU001.

## Capabilities

### New Capabilities
- `checkout-addresses`: qué datos pide el checkout de quien paga y de quien recibe, qué país puede tener cada uno, cuándo son la misma dirección, qué se valida en servidor por país y qué queda congelado en el pedido.

### Modified Capabilities
- `sales-document` (publicada): el comprobante congela y muestra **dos** direcciones —facturación y envío— en vez de "dirección de entrega"; cuando son la misma, lo dice en vez de repetirla.
- `buyer-addresses` (en `libreta-de-direcciones`, sin archivar): la libreta pasa a ser de direcciones de **envío en Colombia**; deja de existir el escenario "la dirección elegida es de otro país y el formulario cambia de país". Una dirección guardada en EE.UU. antes de este cambio no puede elegirse como destino y el checkout la trata como incompleta.

## Impact

- **Datos**: migración versionada sobre `orders` — nuevos `billCountry`, `billState`, `billCity`, `billAddress`, `billAddress2`, `billNeighborhood`, `billZip` y `shipName`, `shipPhone`, `shipDocument`, más `shipSameAsBilling`. **Backfill**: todo pedido existente copia su `ship*` a `bill*` y marca `shipSameAsBilling = true` — hasta hoy la única dirección era la del propio comprador, así que es la lectura históricamente correcta y ningún comprobante ya emitido cambia (está congelado). `shipCountry` se conserva, pasa a valer siempre `CO` en pedidos nuevos.
- **Código**: `orders/checkout-actions.ts` (esquema, validación por país de cada bloque, snapshot), `(tienda)/checkout/checkout-view.tsx` (dos bloques y la pregunta), `orders/message.ts` (WhatsApp), `orders/customer-link.ts` (qué estrena la libreta: la de envío), `invoicing/snapshot.ts` + `pdf.ts` (dos bloques), `admin/pedidos/[id]` y `(tienda)/cuenta/pedidos/[numero]` (mostrar las dos), `buyer/orders.ts`, `notifications/render.ts` (el correo de "enviado" nombra al destinatario cuando no es el comprador).
- **Selector de país/ciudad** (`selector-ciudad.tsx`): sigue sirviendo los dos países; EE.UU. (los ~32.000 lugares del Gazetteer) queda **solo para facturación**. No se borra nada.
- **Comprador con sesión**: `BuyerDefaults` gana la precarga de facturación (último pedido) y la libreta alimenta solo el bloque de envío.
- **Riesgo aceptado**: un pedido USD queda con pagador en EE.UU. y entrega en Colombia, y el número de WhatsApp destino sigue eligiéndose **por la moneda** (PED_HU002 §… "línea EE.UU."). Es coherente: el chat es con quien paga.
- **Riesgo aceptado**: el documento del destinatario es opcional; si una transportadora lo exige, el operador lo pide por WhatsApp como hoy pide cualquier dato faltante.

## Fuera de alcance

- Envíos a Estados Unidos. Es la decisión de negocio que motiva el cambio; no se deja "preparado" un formulario de entrega en EE.UU.
- Facturación electrónica y desglose de impuestos: siguen bloqueados por los insumos del cliente (RUT, IVA, DIAN). Este cambio solo decide *a nombre de quién* va el comprobante.
- Varias direcciones de facturación por cuenta o una libreta de facturación. La de quien paga se precarga del último pedido y se puede corregir; con eso basta.
- Cobro de envío o tarifas por destino. No existe hoy y no se introduce.
- Cambiar el mecanismo de moneda por IP ni la regla "producto sin precio en USD = no disponible en USD".
- Reescribir PED_HU001 en Notion y en el espejo: la spec de este change es la fuente mientras Daniel decide si el alcance nuevo se cotiza. Queda anotado en `notas-tecnicas-privado.md` como deuda documental.

## Bloqueos

Ninguno del cliente: no depende de catálogo, fotos, WhatsApp comercial ni datos legales. Lo único que sí conviene confirmar con el cliente antes de producción —no antes de construir— es si acepta el documento del destinatario como opcional.
