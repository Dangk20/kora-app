# Diseño — Canje de Kora Cashback

## Context

Motivación y la decisión de cuándo descontar, en `proposal.md`. Requisitos en `specs/`.

**Lo que ya existe y hace que esto sea corto:**

- **`consumeCashback()`** está construido y probado: consume del lote más próximo a vencer, escribe un movimiento por cada lote tocado con `sourceMovementId`, y rechaza sin tocar nada si no alcanza. Se construyó en el change anterior precisamente para esto.
- **La cuenta del comprador** resuelve la identidad.
- **`createOrder()`** ya tiene el patrón: revalidar el descuento en servidor y consumirlo dentro de la transacción del pedido.
- **`computeAccrual()`** ya acepta `cashbackApplied`; hoy siempre llega cero.

## Goals / Non-Goals

**Goals**

- Que el descuento lo decida el servidor, siempre.
- Que `confirmOrder()` no pueda fallar por el cashback.
- Que el saldo devuelto no valga más que el que se gastó.

**Non-Goals**

- POS, recálculo por cambio de producto, y sugerir automáticamente cuánto aplicar.

## Decisions

### 1. El pedido guarda el importe, no la lista de lotes

**Decisión:** una columna `cashbackApplied` en el pedido. Qué lotes lo pagaron ya está en el libro, en los movimientos que apuntan a ese pedido.

**Por qué:** guardar los lotes en el pedido sería copiar información que el libro ya tiene, con el riesgo habitual de que las dos copias dejen de coincidir. El importe sí hace falta en el pedido porque es parte de su **snapshot inmutable**: es lo que el operador cobró, y tiene que sobrevivir aunque el libro se reorganice.

### 2. La devolución se reconstruye desde el libro

**Decisión:** devolver lee los movimientos de consumo de ese pedido y **repone el `remaining` de cada lote que apuntan**. No crea lotes.

**Por qué:** es la única forma de conservar el vencimiento original. Un lote nuevo le daría 12 meses de vida a un saldo que estaba por caducar, y bastaría crear y abandonar pedidos para renovarlo indefinidamente — cashback que el negocio ya dio por vencido volviendo a ser gastable para siempre.

**Idempotencia:** el rastro es un movimiento de devolución ligado al pedido. Si ya está, no se hace nada — el mismo patrón que la acreditación, y por el mismo motivo: la cancelación puede llegar dos veces (el trabajo de expiración y el operador a la vez).

**Consecuencia aceptada:** si el lote venció mientras el pedido estaba pendiente, el importe vuelve a un lote vencido y no es gastable. Es correcto: el saldo tenía esa fecha desde que nació, y el pedido abandonado no la extiende.

### 3. La exclusión mutua se comprueba en el servidor, no solo en la pantalla

**Decisión:** la interfaz impide elegir los dos, y `createOrder()` rechaza el pedido si llegan ambos.

**Por qué:** la interfaz orienta, el servidor decide. Es la misma división que ya rige la validación del cupón, y la razón es que la petición no tiene por qué venir de la pantalla.

### 4. El orden dentro de la transacción: primero el saldo, después el pedido

**Decisión:** dentro de la transacción del pedido, consumir el cashback **antes** de crear el pedido; si el consumo falla, no hay pedido.

**Por qué:** `consumeCashback()` bloquea la fila del cliente, que es donde se serializan dos pedidos peleando por el mismo saldo. Tomando el bloqueo pronto, el segundo espera y relee el saldo ya gastado — exactamente lo que hace el motor de inventario con la última unidad.

### 5. La devolución no revive un pedido ni cambia su estado

**Decisión:** devolver el saldo es un efecto **de** la cancelación, no una transición. El estado del pedido solo se mueve por `canTransition()`.

**Por qué:** es la regla que ya rige el sistema. Un módulo que empiece a mover estados por su cuenta rompe la única máquina que los gobierna.

## Dónde vive cada cosa

```
src/modules/cashback/
  redemption.ts   cuánto se puede aplicar y por qué no (función pura + consulta)
  refund.ts       devolución a los lotes originales, idempotente
src/modules/orders/
  checkout-actions.ts   (modificado) aplicar dentro de la transacción
  expire.ts / actions.ts (modificados) devolver al expirar o cancelar
  message.ts            (modificado) el descuento en el mensaje
tests/cashback-redemption.test.ts
```

**Migración:** `cashbackApplied` en el pedido, con valor cero por defecto — todos los pedidos existentes ya son correctos.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Dos pedidos gastan el mismo saldo.** | El bloqueo de la fila del cliente dentro de la transacción los serializa; fijado con una prueba de concurrencia real. |
| **La devolución crea saldo nuevo con vencimiento renovado.** Sería un modo de no perder nunca el cashback. | Se repone el `remaining` de los lotes originales; nunca se crea un lote. Fijado con prueba. |
| **La devolución ocurre dos veces** (expiración y cancelación manual a la vez). | Idempotente contra el rastro del libro, como la acreditación. |
| **Un pedido que expira devuelve saldo que el comprador ya creía perdido**, y le llega sin aviso. | Es a su favor; queda en el historial con su motivo. El aviso al comprador es del módulo de correo (S13). |
| **La acumulación deja de coincidir con lo esperado** cuando el pedido usó saldo. | Es justamente la regla del cliente: se acredita sobre lo pagado con dinero. Ya está fijada con prueba en el change anterior. |

## Migration Plan

1. `cashbackApplied` en el pedido.
2. `redemption.ts` y `refund.ts` **con sus pruebas, antes de tocar el checkout**.
3. Aplicar en `createOrder()`, con la exclusión mutua.
4. Devolver al expirar y al cancelar.
5. El descuento en el mensaje de WhatsApp y en las pantallas.

**Reversión:** ocultar el control del checkout deja de generar canjes nuevos; los ya hechos siguen siendo correctos y devolubles.

## Open Questions

- **¿Avisar al comprador cuando se le devuelve el saldo?** Necesita el módulo de correo, bloqueado por los registros del dominio.
- **¿Puede el operador aplicar cashback desde el panel al confirmar?** Hoy no. Si el negocio lo pide —y es probable, porque el cobro se cierra por WhatsApp— es un change propio: implica que el operador mueva dinero de un cliente, y eso necesita permiso y registro de quién lo hizo.
