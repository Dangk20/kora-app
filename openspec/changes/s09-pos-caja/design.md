## Decisiones

1. **Núcleo sin sesión, acción delgada.** `pos/sale.ts` (`registrarVentaPos(input, actorId)`) hace la venta; `pos/actions.ts` (`cobrarVentaPos`) solo exige `pos:sell` y la llama. Así la prueba de concurrencia cruzada ejercita el código real sin simular la sesión.
2. **Estado `DELIVERED` al nacer.** En mostrador el cliente se lleva el producto en el mismo acto. `confirmedAt` = `deliveredAt` = el instante del cobro, y el comprobante se congela con ese mismo instante.
3. **Sin `order.confirmed`.** Ver proposal §Eventos. Si algún día la caja acumula cashback, será un evento propio (`pos.sale`).
4. **Orden estable de descuento** (por `variantId`), como `confirmOrder`, para que dos ventas con ítems cruzados no se bloqueen entre sí.
5. **El recibo es una página HTML con `@page { size: 80mm auto }`**, no el PDF del comprobante: la térmica imprime desde el navegador y el PDF A4 sigue existiendo para el panel.
