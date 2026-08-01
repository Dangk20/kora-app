# Kora Cashback — acumulación y saldo

**Semana del plan:** **S12**, que el plan todavía nombra "KoraPuntos".

**HUs:** **KPT_HU001 a KPT_HU003 quedan OBSOLETAS.** Describen KoraPuntos —un contador de puntos abstractos, sin canje definido— y ese producto **ya no existe**. Trazar contra ellas sería trazar contra otra cosa. Hay que reescribirlas como historias de Kora Cashback y sincronizar el tablero; se declara aquí en vez de inventar una correspondencia que no hay.

## Why

**El cliente cambió el producto, no un parámetro.** El 1 de agosto reemplazó KoraPuntos por Kora Cashback y entregó reglas completas. La diferencia no es de nombre:

| | KoraPuntos | Kora Cashback |
|---|---|---|
| Qué es | Un contador abstracto | **Dinero** |
| Moneda | No tenía | Dos saldos, sin conversión |
| Vencimiento | No tenía | 12 meses, por lote |
| Canje | **Sin definir** — el módulo estaba bloqueado | Definido: descuento en la compra siguiente |

Se construye ahora porque **todo lo que necesitaba ya existe**: el worker consume `order.confirmed`, el programador de trabajos puede vencer lotes, el módulo de clientes tiene el hueco del saldo mostrando cero, y los cupones —sobre los que el cashback se calcula— están construidos.

Y porque **el modelo quedó cerrado**: las dos preguntas que lo bloqueaban se respondieron el 1 de agosto.

## Las dos respuestas que cerraron el modelo

**El cashback se genera solo sobre el dinero real** — después de cupones, promociones y del propio cashback. El cliente lo explicó con un ejemplo: compra de $100.000, usa $20.000 de saldo, paga $80.000 → genera $2.400. Generarlo sobre el total crearía un ciclo en el que el beneficio se recompensa a sí mismo.

**La ventana de cambios es de 30 días calendario.** Con ese dato se revisó —y se descartó— la maduración que se había propuesto: **la regla de cambios del cliente hace que el recálculo solo pueda subir o quedarse igual**. Producto de igual valor conserva el cashback; de mayor valor lo recalcula sobre un pago mayor; de menor valor no se contempla porque KORA no devuelve dinero. Sin posibilidad de que baje, no hay saldo negativo que prevenir — y 30 días de espera contradirían el mensaje comercial que el propio cliente aprobó: *"úsalo como descuento en tu próxima compra"*.

**El cashback se gana y queda disponible al confirmar el pedido.**

## What Changes

- **Libro contable de cashback por lotes**: cada acreditación con su moneda, su pedido de origen y su propia fecha de vencimiento. El consumo va del lote más antiguo al más nuevo.
- **BREAKING — se eliminan `points_movements` y `pointsBalance`.** Son de KoraPuntos, que ya no existe. Con ellos desaparece la palabra "puntos" del código y de la interfaz, igual que se hizo con "CRM".
- **Acreditación automática al confirmar**, como manejador de la bandeja de salida.
- **Saldo real en el módulo de clientes**, sustituyendo el cero que muestra hoy.
- **Vencimiento automático** de los lotes que cumplen 12 meses, como trabajo programado.
- **Verificación contable** de que el saldo materializado cuadra con el libro.

## Capabilities

### New Capabilities

- `cashback-ledger`: el libro por lotes y el saldo — cómo se acredita, cómo se consume, cómo vence y por qué el saldo materializado siempre cuadra con la suma de sus movimientos.
- `cashback-accrual`: la acreditación al confirmar un pedido — sobre qué base se calcula, cómo se redondea y por qué acreditar dos veces es imposible.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado.

## Fuera de alcance

- **La redención en el checkout** — aplicar el saldo como descuento. Merece su propio change: toca `createOrder()`, que es el camino crítico de la venta, e implica la **exclusión mutua con cupones** que el cliente definió. Este change deja el saldo lleno y verificable; gastarlo es el siguiente paso.
- **El recálculo por cambio de producto.** Falta confirmar con el cliente si, cuando el recálculo sube el cashback, la diferencia se acredita. La lectura natural de "se recalcula" es que sí, pero implica un movimiento nuevo en el libro y no se inventa.
- **El perfil del comprador en la tienda.** Depende del módulo de cuenta (ACC), que no existe: "Mi cuenta" sigue diciendo "Próximamente".
- **Cashback en el POS.** El POS es S9 y no existe.
- **Reescribir las HUs.** Es trabajo de la skill de historias, no de código; queda declarado como pendiente.

## Bloqueos declarados

**Ninguno.** Las reglas están completas desde el 1 de agosto.

## Impact

**Archivos nuevos**
- `src/modules/cashback/` — libro, acreditación, vencimiento y verificación
- `src/modules/events/handlers/order-confirmed-cashback.ts`
- `tests/cashback.test.ts`

**Archivos modificados**
- `prisma/schema.prisma` + migración — el libro de cashback sustituye al de puntos
- `src/modules/jobs/definitions.ts` — el trabajo de vencimiento
- `src/modules/events/handlers/index.ts` — registro del manejador
- Módulo de clientes — el saldo real donde hoy hay un cero
- `package.json` — comando de verificación contable

**Reglas del proyecto que este change NO puede violar**
- **El saldo solo cambia dentro del módulo**, con movimiento en el libro y materialización **en la misma transacción**. Es exactamente la regla 1 del proyecto aplicada a dinero en vez de a stock.
- **Las dos monedas nunca se suman ni se convierten.**
- **La nomenclatura "KoraPuntos" desaparece** de documentos, código e interfaz.

**Riesgo principal**
Esto acredita **dinero**, y lo hace desde una cola cuya entrega es *al menos una vez*. Acreditar dos veces el mismo pedido es regalar saldo, y nadie lo reporta porque el cliente no se queja de que le den de más. La idempotencia se fija con prueba, copiando el patrón que el manejador de ejemplo del worker dejó demostrado.
