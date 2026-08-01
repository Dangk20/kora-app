## 1. Esquema — el libro sustituye a los puntos

- [x] 1.1 Retirar de `prisma/schema.prisma` el modelo `PointsMovement`, el enum `PointsReason`, el campo `pointsBalance` y la relación `pointsMovements` del cliente. No hay datos que conservar: el módulo nunca se construyó.
- [x] 1.2 Añadir el modelo `CashbackMovement`: cliente, `delta` decimal, `currency`, tipo (acreditación / consumo / vencimiento / ajuste), `orderId` opcional, `sourceMovementId` opcional (a qué lote apunta un consumo o vencimiento), `remaining` decimal opcional (solo lo llevan las acreditaciones), `expiresAt` opcional y nota. Índices por `(customerId, currency, createdAt)` y por `(currency, expiresAt)` para el barrido de vencimiento.
- [x] 1.3 Añadir al cliente los dos saldos materializados por moneda, con su comentario apuntando a que son consecuencia del libro y no un número editable.
- [x] 1.4 Crear la migración versionada y aplicarla contra la base local; comprobar que `pnpm db:seed` sigue corriendo.

## 2. El libro de cashback

- [x] 2.1 `src/modules/cashback/money.ts`: el tipo del saldo por moneda —dos bolsas que no se pueden sumar sin decidirlo a propósito— y el truncado hacia abajo (peso en COP, centavo en USD).
- [x] 2.2 `src/modules/cashback/ledger.ts` — `creditCashback()`: crea el lote con su vencimiento a 12 meses y materializa el saldo **en la misma transacción**. Es el único camino que puede subir un saldo.
- [x] 2.3 `ledger.ts` — `consumeCashback()`: consume del lote más próximo a vencer hacia el más nuevo, escribiendo un movimiento por cada lote tocado y bajando su `remaining`. Rechaza sin tocar nada si el disponible en esa moneda no alcanza. Se usará en el change de redención; se construye y se prueba aquí.
- [x] 2.4 `ledger.ts` — `expireCashback()`: vence los lotes cumplidos escribiendo un movimiento negativo por su remanente y dejándolo en cero. Nunca borra ni edita el importe original del lote.
- [x] 2.5 `src/modules/cashback/balance.ts`: disponible por moneda desde los saldos materializados, lotes vigentes con su fecha de vencimiento, historial ordenado, y el **pendiente derivado** de los pedidos creados sin confirmar y aún vigentes.
- [x] 2.6 `src/modules/cashback/verify.ts` + comando `pnpm cashback:verify`: comprueba que cada saldo materializado cuadra con la suma de sus movimientos y que ningún `remaining` es negativo o mayor que su acreditación. **Avisa, no corrige** — igual que `ledger:verify` del inventario.
- [x] 2.7 `src/modules/cashback/README.md`: qué garantiza el módulo, por qué el saldo solo se toca desde aquí y por qué las monedas no se suman.

## 3. Pruebas del libro (antes de conectar nada)

- [x] 3.1 Acreditar deja movimiento y saldo cuadrados; un fallo a mitad no deja ni lo uno ni lo otro.
- [x] 3.2 El consumo cruza varios lotes por antigüedad; consumir más de lo disponible se rechaza sin modificar ningún lote.
- [x] 3.3 Vencer un lote parcialmente consumido solo retira el remanente, y el historial conserva acreditación, consumo y vencimiento.
- [x] 3.4 Las dos monedas se llevan por separado: acreditar en dólares no altera el saldo en pesos.
- [x] 3.5 La verificación contable detecta un saldo descuadrado y **no lo corrige**.

## 4. Acreditación al confirmar el pedido

- [x] 4.1 `src/modules/cashback/accrual.ts`: la base de cálculo y el 3 % truncado hacia abajo. **Corregido en el change `canje-cashback`:** la base es el total del pedido **tal cual**, porque `createOrder()` ya lo guarda neto del cupón y del cashback aplicado. El parámetro `cashbackApplied` que tenía esta función se eliminó — restarlo otra vez habría descontado dos veces, en silencio.
- [x] 4.2 `src/modules/events/handlers/order-confirmed-cashback.ts`: comprueba el rastro en el libro antes de acreditar (¿ya hay lote de este pedido?), acredita en la moneda del pedido y registra el motivo cuando no acredita —pedido sin cliente o base cero— en vez de fallar en silencio.
- [x] 4.3 Registrar el manejador en `src/modules/events/handlers/index.ts`, junto al de ejemplo.
- [x] 4.4 Pruebas de acreditación: los tres importes del cliente ($40.000 → $1.200; base $80.000 → $2.400; USD $40 → USD 1,20), el truncado con decimales, y **el mismo evento entregado dos veces deja un solo lote**.
- [x] 4.5 Prueba de punta a punta: confirmar un pedido real, correr el worker una vez y ver el saldo del cliente subir.

## 5. Vencimiento automático

- [x] 5.1 Registrar el trabajo `cashback:expire` en `src/modules/jobs/definitions.ts` con cadencia diaria, informando cuántos lotes venció y por qué importe.
- [x] 5.2 Prueba: con lotes cumplidos, el trabajo los vence y deja constancia; sin ellos, termina con éxito informando que no había nada.

## 6. El saldo en el módulo de clientes

- [x] 6.1 Sustituir el cero del perfil del cliente por el saldo real: disponible por moneda, pendiente y próxima fecha de vencimiento, con el nombre "Kora Cashback".
- [x] 6.2 Historial de cashback del cliente —ganado, usado y vencido— con el pedido de origen cuando lo hay.
- [x] 6.3 Cuando un cliente no tenga saldo, decir por qué en lugar de mostrar un cero sin explicación.
- [x] 6.4 Retirar del listado y del panel de cliente toda referencia a "puntos"; comprobar con una búsqueda en `src/` que no queda ninguna.

## 7. Documentación y cierre

- [x] 7.1 Actualizar `openspec/config.yaml`: la nomenclatura de KoraPuntos deja paso a Kora Cashback, con la regla de que las monedas no se suman.
- [x] 7.2 Actualizar el `CLAUDE.md` de la app con el módulo de cashback y su regla de saldo, y anotar en la bitácora de sprints.
- [x] 7.3 Anotar en `../notas-tecnicas-privado.md` lo que queda abierto: la redención en el checkout con su exclusión mutua con cupones, y el recálculo por cambio de producto pendiente de confirmación del cliente.
- [x] 7.4 Declarar en `../hus-korapuntos.md` que KPT_HU001–003 quedan obsoletas y hay que reescribirlas como historias de Kora Cashback, sincronizando el tablero.
- [x] 7.5 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
