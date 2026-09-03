## 1. Esquema y dependencia

- [x] 1.1 Añadir `pdf-lib` a las dependencias y comprobar que no arrastra binarios nativos
- [x] 1.2 Modelo `SalesDocument` en `schema.prisma`: `orderId` único, `number`, `issuedAt`, `currency`, `snapshot Json`
- [x] 1.3 Migración versionada y reinicio de `pnpm dev` (el cliente de Prisma en memoria queda viejo)

## 2. El documento congelado

- [x] 2.1 `src/modules/invoicing/snapshot.ts`: tipo del snapshot y su armado desde un pedido
- [x] 2.2 `freezeSalesDocument(tx, orderId)` — idempotente por el índice único, no por leer antes
- [x] 2.3 Llamarlo dentro de la transacción de `confirmOrder()`
- [x] 2.4 `ensureSalesDocument(orderId)`: emite al vuelo un comprobante que falta, fechado con la confirmación real (pedidos anteriores al cambio)

## 3. Render a PDF

- [x] 3.1 `src/modules/invoicing/pdf.ts`: maqueta con logo, datos del comerciante, del comprador, entrega, líneas y totales
- [x] 3.2 Formatear importes con `formatMoney` del módulo de precios — una sola definición de cómo se ve el dinero
- [x] 3.3 Título "Comprobante de pedido" y la leyenda de que no es factura electrónica
- [x] 3.4 Sin ninguna línea de IVA
- [x] 3.5 Verificar que el PDF abre correctamente y que el módulo no importa nada de Next (lo usa el worker)

## 4. Adjunto en el correo

- [x] 4.1 `attachments?` en `EmailMessage`
- [x] 4.2 Driver de archivo: escribir el adjunto junto al `.html` en `.emails/`
- [x] 4.3 Driver de Resend: entregarlo con el mensaje
- [x] 4.4 Adjuntar el comprobante al correo `BUYER_CONFIRMED`
- [x] 4.5 Si el PDF falla, el correo sale igual sin adjunto y el fallo se registra

## 5. Acceso desde el panel y desde la cuenta

- [x] 5.1 Ruta del comprobante en el panel, con `requirePermission("orders:view")`
- [x] 5.2 Ruta del comprobante en la cuenta del comprador, con el `customerId` en el `where`
- [x] 5.3 Ver y descargar en el detalle del pedido del panel
- [x] 5.4 Ver y descargar en el detalle del pedido de la cuenta del comprador
- [x] 5.5 No ofrecer comprobante en pedidos pendientes, cancelados o expirados

## 6. Factura electrónica anunciada

- [x] 6.1 `src/modules/invoicing/lock.ts` con el patrón de `campaigns/lock.ts`
- [x] 6.2 Botón presente, desactivado, "Muy pronto", explicando qué falta

## 7. Pruebas

- [x] 7.1 Confirmar emite un comprobante; confirmar dos veces no emite dos
- [x] 7.2 Una confirmación revertida no deja comprobante
- [x] 7.3 El snapshot sobrevive a cambios de producto, de dirección y de datos del comerciante
- [x] 7.4 Prueba de código fuente: todo archivo que escriba `status: "CONFIRMED"` llama a `freezeSalesDocument`
- [x] 7.5 El comprobante de otro comprador no se entrega
- [x] 7.6 El correo de confirmación sale aunque falle el PDF
- [x] 7.7 El documento no contiene la palabra "IVA" ni se titula "Factura"

## 8. Cierre

- [x] 8.1 `pnpm typecheck && pnpm lint && pnpm build` y la suite completa (pedir permiso: comparte base con `pnpm dev`)
- [x] 8.2 README del módulo `invoicing/`
- [x] 8.3 Actualizar `CLAUDE.md` y la bitácora de sprints; anotar los insumos pendientes del cliente en `notas-tecnicas-privado.md`

## Verificación de punta a punta (2 sep 2026)

Pedido `KO-2026-08256` creado desde la tienda y confirmado en el panel:
comprobante emitido en la misma transacción, correo `multipart/mixed` con el
PDF adjunto en `.emails/`, y la tarjeta de Documentos visible en el detalle del
pedido. 769 pruebas verdes.
