# Consumidor de la bandeja de salida de eventos

**Semana del plan:** habilita **S10 (módulo de clientes)**, **S11 (dashboard)**, **S12 (Kora Cashback)** y **S13 (email de remarketing)**. No es una semana en sí: es la pieza que las cuatro necesitan y ninguna tiene.

**HUs asociadas:** **ninguna, y es deliberado.** Las historias de usuario del proyecto describen comportamiento observable por una persona; esto es plomería interna. Se relaciona con **PED_HU004** (panel de pedidos y `order.confirmed`), que ya está construida y es quien **produce** los eventos que aquí se consumen. No se inventa una HU para justificarlo.

## Why

`confirmOrder()` escribe `order.confirmed` en `domain_events` dentro de la misma transacción que descuenta el stock y cambia el estado del pedido. El patrón está bien construido y probado: si la transacción falla, no queda ni el descuento ni el evento.

**Pero nadie lee esa tabla.** Los eventos se acumulan en `PENDING` desde que se construyó el panel de pedidos, a la espera exacta de este trabajo. La consecuencia en operación es concreta: **confirmar un pedido no dispara ninguno de sus efectos**. El evento central del sistema es hoy un evento que nadie escucha.

Se hace ahora y no más adelante porque **cuatro módulos del plan dependen de él y ninguno puede empezar antes**:

| Módulo | Qué necesita del evento |
|---|---|
| **Kora Cashback** (S12) | Acreditar el 3 % de la compra. El cliente entregó la lógica el 1 ago y sustituye a KoraPuntos |
| **Módulo de clientes** (S10) | Historial de compras y totales acumulados |
| **Dashboard** (S11) | Hoy muestra datos de ejemplo |
| **Email de remarketing** (S13) | Disparar los correos posteriores a la compra |

Y hay un costo que crece solo: cada pedido confirmado hasta hoy dejó un evento sin procesar. Cuando el consumidor exista, esa acumulación se procesará de golpe — conviene que ocurra con pocos eventos de prueba y no con meses de pedidos reales.

## What Changes

- **Un proceso que consume la bandeja de salida**, separado de la aplicación web: sondea los eventos pendientes, los entrega a sus manejadores y marca el resultado.
- **Toma de eventos segura entre trabajadores concurrentes.** Dos procesos no pueden tomar el mismo evento.
- **Reintentos con espera creciente y un límite.** Lo que agota sus intentos queda en un estado terminal **visible**, no reintentándose en silencio para siempre.
- **Registro de manejadores por tipo de evento.** Añadir un consumidor nuevo no obliga a tocar el motor.
- **Observabilidad.** Poder responder, sin entrar a la base a mano: cuántos eventos hay pendientes, cuántos muertos, y desde cuándo está atascado el más viejo.
- **Migración de esquema** para soportar la espera creciente: hoy `domain_events` tiene `attempts` y `lastError` pero **no tiene cuándo reintentar**, así que un evento fallido se reintentaría en el siguiente ciclo sin ninguna espera.
- **Un manejador de ejemplo**, verificable de punta a punta, que demuestra el contrato: recibe el evento, es idempotente y deja rastro.
- **Despliegue en los dos entornos** del VPS con su presupuesto de memoria declarado, por el mismo camino que la aplicación.

## Capabilities

### New Capabilities

- `event-consumption`: el motor que toma eventos de la bandeja de salida y los entrega a sus manejadores — exclusividad entre trabajadores, reintentos acotados, estado terminal para lo que no se puede procesar, y la garantía de que reprocesar no duplica efectos.
- `event-observability`: poder responder en cualquier momento si la cola está sana, cuántos eventos esperan, cuántos murieron y desde cuándo, **sin consultar la base a mano**.

### Modified Capabilities

Ninguna. `openspec/specs/` no contiene todavía ninguna capacidad publicada: el primer change del proyecto (`vps-two-stack-deploy`) aún no se ha archivado.

## Fuera de alcance

- **El manejador de acreditación de Kora Cashback.** Va en su propio change: su modelo de datos aún tiene preguntas abiertas con el cliente (plazo de la ventana de cambios, del que depende cuándo madura el saldo, y si pagar con cashback genera cashback). Este change deja el enchufe listo, no el aparato conectado.
- **Módulo de clientes, dashboard real y email de remarketing.** Son sus propias semanas del plan.
- **Cron de expiración de pedidos** (`pnpm orders:expire`): existe y funciona, solo falta programarlo. Es un change aparte y pequeño.
- **Colas externas (BullMQ) y mensajería distribuida.** El plan técnico las reserva para S13 y solo para volumen de correo. Aquí sobran.
- **Eventos nuevos.** Este change consume `order.confirmed`, que ya se emite. No añade tipos de evento.

## Bloqueos declarados

**Ninguno.** No depende de ningún insumo pendiente del cliente. Es, precisamente, la razón por la que es el siguiente trabajo: todo lo demás en la lista espera algo.

## Impact

**Archivos nuevos**
- `src/modules/events/` — motor de consumo, registro de manejadores y contrato del manejador
- `scripts/outbox-worker.ts` — proceso de larga duración, junto a `expire-orders.ts` y `verify-ledger.ts`
- `tests/outbox.test.ts` — concurrencia, idempotencia, reintentos y estado terminal

**Archivos modificados**
- `prisma/schema.prisma` + migración — campo para la espera entre reintentos
- `package.json` — comando del worker
- `deploy/docker-compose.staging.yml` y `deploy/docker-compose.prod.yml` — el worker como servicio, con su límite de memoria
- `deploy/README.md` — el presupuesto de memoria cambia

**Reglas del proyecto que este change NO puede violar** *(y que la spec debe reflejar)*
- El worker **jamás** modifica `stockActual` ni `onlineUnits` fuera del motor de inventario. Si algún manejador necesitara mover stock, lo hace llamando al motor.
- **No calcula precios.** `resolvePrice()` sigue siendo la única fuente.
- **No retrocede estados de pedido.** Cualquier transición pasa por `canTransition()`.

**Riesgo principal**
El worker corre **fuera** del ciclo de petición y respuesta: si falla, nadie lo ve en una pantalla. Por eso la observabilidad no es un extra de este change sino la mitad de su valor — una cola atascada que se descubre por el cliente es peor que no tener cola.
