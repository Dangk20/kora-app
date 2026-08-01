## 1. Esquema

- [x] 1.1 Añadir `cashbackApplied` al pedido (decimal, cero por defecto), con el comentario de que es parte del snapshot inmutable: es lo que el operador cobró.
- [x] 1.2 Migración versionada y aplicada.

## 2. Aplicar y devolver

- [x] 2.1 `src/modules/cashback/redemption.ts`: cuánto se puede aplicar —el menor entre lo pedido, el saldo disponible **en la moneda del pedido** y el total— con el motivo cuando el importe es cero. Función pura para el tope, más la consulta del saldo.
- [x] 2.2 `src/modules/cashback/refund.ts`: devolver el saldo de un pedido reponiendo el `remaining` de **los lotes originales**, nunca creando uno nuevo, e idempotente contra el rastro del libro.
- [x] 2.3 Pruebas del tope: se rechaza pedir más del disponible; el saldo mayor que el total se recorta al total; un pedido en dólares no puede gastar saldo en pesos.
- [x] 2.4 Pruebas de la devolución: el lote recupera su remanente **con su vencimiento original**; devolver dos veces sube el saldo una sola vez; un lote que venció mientras tanto recibe el importe sin volverlo gastable.

## 3. El checkout

- [x] 3.1 `createOrder()` acepta el importe de cashback pedido y lo **recalcula en servidor**: nada de lo que llegue del navegador fija el descuento.
- [x] 3.2 Consumir el saldo **dentro de la transacción del pedido y antes de crearlo**: el bloqueo de la fila del cliente serializa a dos pedidos que peleen por el mismo saldo.
- [x] 3.3 Exclusión mutua con cupones: rechazar el pedido si llegan los dos, con su mensaje.
- [x] 3.4 Guardar `cashbackApplied` en el pedido y restarlo del total.
- [x] 3.5 Prueba de concurrencia: dos pedidos simultáneos sobre un saldo que solo alcanza para uno → exactamente uno gana y el saldo nunca queda negativo.
- [x] 3.6 Prueba: si la creación del pedido falla después de consumir, no queda ni pedido ni consumo.

## 4. Devolución en el ciclo del pedido

- [x] 4.1 La expiración de pedidos pendientes devuelve el cashback aplicado.
- [x] 4.2 La cancelación desde el panel también, sin que ningún módulo mueva el estado por su cuenta.
- [x] 4.3 Prueba: un pedido con saldo aplicado que expira devuelve el saldo; uno confirmado no lo devuelve.

## 5. Lo que se ve

- [x] 5.1 Control en el checkout para aplicar saldo, visible **solo con sesión**, con el disponible en la moneda del pedido y el aviso de que no se combina con cupón.
- [x] 5.2 El resumen del checkout muestra el cashback aplicado como línea propia, distinta del cupón.
- [x] 5.3 El **mensaje de WhatsApp** muestra el descuento y el total ya rebajado — es el documento con el que el operador cobra.
- [x] 5.4 El detalle del pedido, en la cuenta del comprador y en el panel, muestra cuánto se pagó con cashback.
- [x] 5.5 La pantalla de la cuenta deja de decir "menciónalo al confirmar por WhatsApp".

## 6. Documentación y cierre

- [x] 6.1 Actualizar el README del módulo de cashback, el `CLAUDE.md` de la app y la bitácora.
- [x] 6.2 Anotar en `../notas-tecnicas-privado.md` la decisión de descontar al crear (y por qué difiere del stock) y la pregunta abierta de si el operador podrá aplicar saldo desde el panel.
- [x] 6.3 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
