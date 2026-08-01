# Diseño — consumidor de la bandeja de salida

## Context

Motivación en `proposal.md` §Why. Requisitos en `specs/`. Aquí solo lo que condiciona el enfoque.

**Lo que ya existe y funciona.** `confirmOrder()` escribe el evento en la misma transacción que descuenta stock y cambia el estado — el patrón de bandeja de salida transaccional está resuelto. La tabla es:

```
domain_events
  id · type · payload(Json) · status · attempts · lastError · processedAt · createdAt
  índice (status, createdAt)

EventStatus: PENDING · PROCESSING · PROCESSED · FAILED
```

El evento `order.confirmed` lleva: `orderId`, `orderNumber`, `customerId`, `currency`, `total` (como texto, para no perder precisión), `confirmedAt`, `confirmedById`.

**Tres huecos del modelo actual**, que el diseño tiene que resolver:

1. **No hay cuándo reintentar.** Con `attempts` y `lastError` pero sin fecha del próximo intento, un evento fallido vuelve a tomarse en el ciclo siguiente, sin espera.
2. **`PROCESSING` no dice desde cuándo.** Si un proceso muere mientras trabaja, su evento queda ahí para siempre y nadie sabe si está en curso o abandonado.
3. **`FAILED` es ambiguo.** No distingue "falló y va a reintentar" de "agotó sus intentos y está muerto".

**Contexto de operación.** Dos entornos sobre un VPS de 2 vCPU y 7.9 GB, con 2.5 GB de margen libre. Ya existen tres trabajos fuera de la aplicación (`expire-orders`, `verify-ledger`, `set-whatsapp`) que establecen el patrón: un script de TypeScript con `tsx`, invocado por `package.json`.

## Goals / Non-Goals

**Goals**

- Que un evento escrito en la bandeja **siempre** termine en un estado terminal, y que se pueda saber en cuál sin abrir la base.
- Que la exclusión entre trabajadores sea una propiedad de la base de datos, no una suposición sobre cuántos procesos corren.
- Que añadir el manejador de cashback la semana que viene sea registrar una función, no tocar el motor.

**Non-Goals de diseño**

- **Orden garantizado entre eventos.** Se evalúa abajo y se descarta con argumento.
- **Entrega exactamente una vez.** No existe sin transacciones distribuidas. Se compra con idempotencia, que es más barato y más robusto.
- **Distribución entre máquinas.** Un proceso por entorno, en la misma máquina que la base.
- **Reintento automático de eventos muertos.** Es deliberadamente manual.

## Decisions

### 1. Sondeo sobre la propia tabla, sin cola externa

**Decisión:** el worker consulta periódicamente `domain_events`. No se introduce BullMQ, Redis Streams ni ningún intermediario.

**Por qué:** el evento **ya está** en PostgreSQL, escrito atómicamente con el cambio de negocio que lo produjo. Meter una cola externa obliga a copiarlo ahí — y esa copia es un segundo escritor que puede fallar por su cuenta, reintroduciendo justo el problema que la bandeja de salida resuelve. Habría que sincronizar dos almacenes de verdad.

El volumen tampoco lo justifica: son pedidos confirmados a mano por un operador. Hablamos de decenas al día, no de miles por segundo. Un sondeo cada pocos segundos deja latencia imperceptible para el negocio.

**Alternativa considerada — `LISTEN/NOTIFY` de PostgreSQL:** elimina la latencia del sondeo, pero las notificaciones **se pierden si nadie escucha**, así que igual hace falta el sondeo como red de seguridad. Añade una pieza para optimizar un retraso de segundos que a nadie le importa. Se puede incorporar después sin rediseñar nada.

**Alternativa considerada — BullMQ:** el plan técnico lo reserva para S13, y para lo que sí lo necesita: enviar diez mil correos sin degradar la tienda. Ese es un problema de *reparto de trabajo pesado*, no de *entrega confiable de eventos*. Traerlo aquí es resolver un problema que no tenemos con una pieza que hay que operar.

### 2. La exclusión la garantiza la base, no la disciplina

**Decisión:** la toma de eventos usa `SELECT ... FOR UPDATE SKIP LOCKED` dentro de una transacción, marcando los eventos como en proceso en el mismo paso. Se implementa con SQL directo, porque Prisma no expone `SKIP LOCKED`.

**Por qué:** es exactamente el mismo razonamiento que sostiene el motor de inventario. "En la práctica solo corre un worker" es una suposición que se rompe sola el día de un despliegue solapado, de un reinicio o de un segundo proceso arrancado por error — y aquí el precio de romperla es **acreditar dinero dos veces**.

`SKIP LOCKED` es lo que permite además que un trabajador lento no bloquee al otro: el segundo salta las filas tomadas en lugar de esperar.

**Alternativa descartada:** un bloqueo consultivo global, que serializa todo el consumo y hace inútil tener más de un trabajador.

### 3. Cuatro estados con significados distintos, más el reloj del reintento

**Decisión:** se añade a `domain_events` un campo con **la fecha del próximo intento** y se precisa el significado de los estados existentes:

| Estado | Significa |
|---|---|
| `PENDING` | Esperando. Se toma cuando llega su fecha de próximo intento |
| `PROCESSING` | Tomado por un trabajador. Con marca de cuándo se tomó |
| `PROCESSED` | Terminado con éxito |
| `FAILED` | **Muerto**: agotó sus intentos. Terminal, no se vuelve a tomar |

Un fallo intermedio **no** deja el evento en `FAILED`: lo devuelve a `PENDING` con el contador aumentado y la próxima fecha calculada. `FAILED` pasa a significar únicamente "muerto", que es lo que la observabilidad necesita distinguir.

**Espera entre intentos:** creciente, con un máximo, de forma que un fallo pasajero se recupere en segundos y una dependencia caída no genere carga sostenida. Con 5 intentos, un evento vive unos minutos antes de morir — tiempo suficiente para un reinicio de base de datos, no tanto como para que un problema real pase inadvertido.

**Eventos abandonados:** un evento en `PROCESSING` más allá de un umbán prudente se considera huérfano de un proceso muerto y vuelve a `PENDING`. Es lo que hace cierto el escenario "el proceso muere a mitad de un evento".

### 4. Un evento, todos sus manejadores, un solo estado

**Decisión:** el estado es del **evento**, no de la pareja evento–manejador. Un evento se considera procesado cuando **todos** sus manejadores tuvieron éxito; si alguno falla, el evento entero se reintenta y **todos** los manejadores se ejecutan de nuevo.

**Por qué:** el modelo alternativo —una tabla de entregas por manejador— es más preciso pero duplica el estado y la lógica. Con manejadores idempotentes (que la spec exige de todos modos) reejecutar los que ya tuvieron éxito **no tiene efecto**, así que la precisión extra no compra nada real.

**Consecuencia aceptada y explícita:** un manejador roto de forma permanente arrastra al evento entero a estado muerto, aunque los demás hubieran funcionado. Con dos o tres consumidores es asumible y visible en el diagnóstico. **Disparador para revisarlo:** cuando haya manejadores con vidas independientes de verdad — por ejemplo, que el envío de un correo pueda fallar sin que eso deba marcar como fallida la acreditación del cashback.

### 5. El orden no se garantiza, y se dice por qué

**Decisión:** los eventos se toman por antigüedad, pero **no se garantiza** el orden de procesamiento entre eventos de un mismo cliente.

**Por qué:** los eventos que hoy existen son **independientes entre sí**. `order.confirmed` de dos pedidos del mismo cliente puede procesarse en cualquier orden: cada uno acredita su propio cashback sobre su propio pedido. No hay ninguna operación que dependa del resultado de la anterior.

Garantizar orden por cliente exigiría serializar por cliente y volvería mucho más complejo el reparto, a cambio de una propiedad que nada necesita hoy.

**Disparador para reconsiderarlo:** el primer evento cuyo efecto dependa del estado dejado por otro evento del mismo cliente. Cuando aparezca, se decide entonces con el caso concreto delante.

### 6. Proceso separado, no un hilo de la aplicación web

**Decisión:** un contenedor propio por entorno, con el mismo comando y la misma imagen que la aplicación.

**Por qué:** dentro del proceso web, el worker competiría por memoria y CPU con las peticiones de los compradores, se multiplicaría al escalar réplicas (varios workers sin querer), y no se podría reiniciar sin cortar el tráfico. Separado, se le pone su propio límite de memoria, se ve su propio registro y se reinicia sin que nadie lo note.

Reutilizar la misma imagen evita construir y versionar una segunda: es el mismo código, distinto punto de entrada.

**Presupuesto:** el worker es liviano — sondea y llama funciones. Con el margen actual de 2.5 GB, cabe con holgura en los dos entornos sin tocar los límites existentes.

### 7. El diagnóstico es un comando, no una pantalla

**Decisión:** un comando de consola que imprime el estado de la bandeja, en la línea de `pnpm ledger:verify`.

**Por qué:** el consumidor de este dato hoy es el equipo técnico, no el operador de la tienda. Un comando se puede ejecutar por SSH, encadenar a un cron y leer en los registros. Una pantalla en el panel exige permisos, diseño fiel al prototipo y traducción de conceptos que al operador no le dicen nada.

**Cuándo cambia:** si el cliente necesita ver por sí mismo que "los correos están saliendo", eso es una pantalla del panel y su propio trabajo.

## Dónde vive cada cosa

```
src/modules/events/
  types.ts              contrato del manejador y del evento
  registry.ts           registro de manejadores por tipo
  consumer.ts           toma, ejecuta, marca resultado, calcula reintentos
  health.ts             conteos y antigüedad del pendiente más viejo
  handlers/             manejadores registrados
scripts/outbox-worker.ts   proceso de larga duración (bucle + parada ordenada)
scripts/outbox-status.ts   diagnóstico por consola
tests/outbox.test.ts       concurrencia, idempotencia, reintentos, muerte, huérfanos
```

**Migración de Prisma:** sí — un campo de fecha del próximo intento sobre `domain_events`, con valor por defecto, y un índice que soporte la consulta de toma (estado + fecha del próximo intento). Los eventos ya acumulados quedan elegibles de inmediato.

**Eventos de dominio:** este change **consume** `order.confirmed`; no emite ninguno nuevo.

**Pantallas:** ninguna. No hay equivalente en el prototipo aprobado porque no es una pantalla — es plomería.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El worker se cae y nadie lo nota.** Corre fuera del ciclo de petición y respuesta: no hay una pantalla que se rompa. | La observabilidad es la mitad del valor de este change. Reinicio automático del contenedor, y el diagnóstico expone la **antigüedad del pendiente más viejo**, que es la señal que distingue "hay carga" de "está atascado". |
| **Un manejador no idempotente acredita dinero dos veces.** | La idempotencia es requisito de la spec y se fija con prueba automatizada. El manejador de ejemplo de este change existe precisamente para dejar el patrón demostrado antes de que llegue el de cashback. |
| **Un manejador roto arrastra a los demás** (decisión 4). | Asumido con dos o tres consumidores, y visible en el diagnóstico. Disparador escrito para pasar a entregas por manejador. |
| **Los eventos acumulados se procesan todos de golpe** al arrancar por primera vez. | Se limita cuántos eventos se toman por ciclo. Hoy son pocos y de prueba; conviene que ocurra ahora y no con meses de pedidos reales encima. |
| **El sondeo añade latencia** entre confirmar y ver el efecto. | Segundos, e imperceptible para un flujo donde el pago se acuerda por WhatsApp. `LISTEN/NOTIFY` queda disponible si algún día importa. |
| **La espera entre reintentos puede enmascarar un fallo real** durante minutos. | Acotada por el número máximo de intentos: agotados, el evento muere y aparece en el diagnóstico. |

## Migration Plan

Sin migración de datos. Los eventos acumulados en `PENDING` se procesan solos en cuanto el worker arranque — es precisamente el objetivo.

1. Migrar el esquema (campo de próximo intento e índice). No rompe nada: la aplicación no lo lee todavía.
2. Construir motor, registro y diagnóstico, con sus pruebas.
3. Arrancar el worker **a mano** contra el entorno de pruebas y observar cómo drena los eventos ya acumulados.
4. Añadirlo como servicio a los dos entornos y desplegarlo por el camino habitual.

**Reversión:** detener el contenedor del worker. Los eventos vuelven a acumularse en `PENDING`, que es exactamente el estado de hoy — sin pérdida y sin daño. La migración de esquema solo añade una columna con valor por defecto y no necesita revertirse.

## Open Questions

- **Intervalo de sondeo y tamaño del lote por ciclo.** Se ajustan viendo el comportamiento real en pruebas; no cambian ni las specs ni el reparto de tareas. Punto de partida: unos pocos segundos y lotes pequeños.
- **Umbral para considerar huérfano un evento en proceso.** Debe superar con margen la duración del manejador más lento. Se fija tras medir el manejador de ejemplo.
