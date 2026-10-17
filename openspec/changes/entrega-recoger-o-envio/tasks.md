## 1. Datos
- [x] 1.1 Enum `DeliveryMethod { SHIPPING PICKUP }` y `Order.deliveryMethod @default(SHIPPING)`; migración versionada; reiniciar `pnpm dev`.

## 2. Servidor — `orders/`
- [x] 2.1 `tienda-fisica.ts`: dirección y horario desde `KORA_TIENDA_DIRECCION` / `KORA_TIENDA_HORARIO`, ciudad fija Neiva.
- [x] 2.2 `checkout-actions.ts`: `deliveryMethod` obligatorio; bloque `pickup` (nombre, celular +57, documento opcional) y `pickupByPayer`; validación; snapshot `PICKUP` en `ship*` sin dirección.
- [x] 2.3 `message.ts`: bloque "🏬 Recoger en tienda (Neiva)".
- [x] 2.4 Pruebas: recoge quien paga, recoge otra persona (pagador US), sin método rechazado, celular inválido, mensaje de WhatsApp; envío sin cambios.

## 3. Checkout — `(tienda)/checkout/checkout-view.tsx` + `messages/`
- [x] 3.1 Pregunta inicial con dos tarjetas; el resto del formulario y el botón solo tras elegir.
- [x] 3.2 Camino recoger: tarjeta de la tienda, "La recojo yo" (CO) o quién recoge.
- [x] 3.3 Textos en `es` y `en`.

## 4. Consumidores
- [x] 4.1 Comprobante: `delivery` en el snapshot y bloque "RECOGER EN TIENDA".
- [x] 4.2 Correos: el de "enviado" no habla de envío en un pedido para recoger.
- [x] 4.3 Panel del pedido y cuenta del comprador.

## 5. Cierre
- [x] 5.1 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
- [x] 5.2 Pase manual en local de los dos caminos.
- [x] 5.3 Bitácora y CLAUDE.md actualizados.
