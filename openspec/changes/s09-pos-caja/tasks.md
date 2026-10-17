## 1. Venta — `src/modules/pos/`
- [x] 1.1 `catalog.ts`: productos activos con variante, SKU, código de barras, precio de tienda COP y stock; búsqueda y categorías.
- [x] 1.2 `sale.ts`: `registrarVentaPos` (validación, precio de tienda, transacción con motor + pedido DELIVERED + comprobante).
- [x] 1.3 `actions.ts`: `cobrarVentaPos` con `requirePermission("pos:sell")`.

## 2. Pantallas — `src/app/pos/`
- [x] 2.1 Caja: buscador/escáner, categorías, grilla, ticket, cobro con método y vueltas.
- [x] 2.2 Recibo de 80 mm imprimible.
- [x] 2.3 Menú del panel: "Punto de venta" sin el "S9".

## 3. Pruebas
- [x] 3.1 Venta descuenta stock y deja pedido POS entregado con comprobante; precio de tienda; más de lo que hay → rechazo sin descontar; efectivo insuficiente.
- [x] 3.2 Concurrencia cruzada web + POS sobre stock = 1 → exactamente una gana.
- [x] 3.3 `comprobante.test.ts` incluye `pos/sale.ts`.

## 4. Cierre
- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
- [x] 4.2 Pase manual de una venta completa con recibo.
- [x] 4.3 Bitácora y CLAUDE.md.

## 5. Turno de caja (17 oct 2026)
- [x] 5.1 `CashSession` + `CashMovement`, con índice único parcial (un turno abierto por caja).
- [x] 5.2 `pos/turno.ts`: abrir, salidas, resumen, cerrar, base que queda; la venta exige turno (FOR SHARE) y el cierre bloquea (FOR UPDATE).
- [x] 5.3 Apertura en pantalla completa por pasos, franja del turno, salida de dinero, cierre con resumen y barras por método, "¿dejar base?".
- [x] 5.4 Pruebas del turno en `tests/pos.test.ts` (caja propia de pruebas).
- [ ] 5.5 Reporte de cierre imprimible y "Cierres de caja" en el panel.

