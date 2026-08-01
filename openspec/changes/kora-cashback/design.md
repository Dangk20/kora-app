# Diseño — Kora Cashback

## Context

Motivación en `proposal.md`. Requisitos en `specs/`. Reglas del cliente en `../../business/kora-cashback-reglas-cliente.md`.

**Lo que ya existe y hace posible este change:**

- **El worker consume `order.confirmed`** desde la bandeja de salida, con reintentos, muerte terminal y diagnóstico. Su manejador de ejemplo dejó **demostrado el patrón de idempotencia**: comprobar el rastro antes de aplicar el efecto.
- **El programador de trabajos** corre dentro de ese mismo worker; añadir el vencimiento es registrar una definición.
- **El motor de inventario** es el modelo a copiar: libro append-only + columna materializada, ambos en la misma transacción, con un trabajo nocturno que comprueba que cuadran.
- **Los cupones** ya descuentan del total, así que el "valor pagado" sobre el que se calcula el cashback existe tal cual en el pedido.
- **El módulo de clientes** tiene el bloque de saldo mostrando cero, esperando esto.

**Lo que hay que retirar:** `PointsMovement`, `PointsReason` y `pointsBalance`. Son de KoraPuntos. Ningún dato real cuelga de ellos —el módulo nunca se construyó— y la interfaz los usa en un solo sitio: el bloque del perfil del cliente.

## Goals / Non-Goals

**Goals**

- Que el saldo sea **siempre** explicable por su libro, como el stock.
- Que acreditar dos veces sea imposible, no improbable.
- Que el vencimiento a 12 meses ocurra solo y quede registrado.

**Non-Goals de diseño**

- **Gastar el saldo.** Es el siguiente change: toca `createOrder()` e implica la exclusión mutua con cupones.
- **Recalcular por cambio de producto.** Falta una confirmación del cliente.
- **Caché del saldo.** Ya hay una columna materializada; añadir otra capa es duplicar el problema de invalidación.

## Decisions

### 1. Libro por lotes con remanente, no dos tablas

**Decisión:** una sola tabla de movimientos donde las **acreditaciones** llevan además `remaining`, `currency`, `orderId` y `expiresAt`. Consumos y vencimientos son movimientos negativos que apuntan al lote que agotan.

**Por qué:** la alternativa —una tabla de lotes y otra de movimientos— separa dos cosas que siempre se leen juntas y obliga a mantenerlas coherentes entre sí. Con una sola tabla, el saldo es la suma de los remanentes vigentes y el historial es la misma tabla ordenada por fecha: **una sola verdad, dos lecturas**.

**Coste aceptado:** las filas de acreditación tienen campos que las de consumo no usan. Es el precio de no tener dos fuentes que sincronizar.

### 2. El saldo se materializa por moneda

**Decisión:** dos columnas de saldo en el cliente, una por divisa, actualizadas en la misma transacción que el movimiento.

**Por qué:** el listado de clientes y el perfil consultan saldo en cada carga; recalcularlo sumando lotes en cada consulta convierte una pantalla en una agregación. Materializar es exactamente lo que ya hace `stockActual` — y por eso hereda su obligación: **un trabajo que compruebe que cuadra**.

Dos columnas y no una con moneda porque **un cliente puede tener saldo en las dos a la vez**. Es la misma razón por la que los cupones llevan dos importes.

### 3. La idempotencia se comprueba contra el libro, no contra una marca

**Decisión:** antes de acreditar, el manejador busca si ya existe una acreditación **de ese pedido**. Si la hay, no hace nada.

**Por qué:** una marca aparte —un campo "cashbackAcreditado" en el pedido— es un segundo estado que puede desincronizarse del libro: si se escribe la marca y falla el movimiento, el cashback no existe y el sistema cree que sí. El propio libro es la verdad, y preguntar por su rastro no puede mentir.

Es el patrón que el manejador de ejemplo del worker dejó demostrado, y aquí importa más: **lo que se duplicaría es dinero, y nadie reclama que le den de más.**

### 4. La base de cálculo es el total del pedido, ya descontado

**Decisión:** el 3 % se calcula sobre el `total` del pedido, que **ya viene con los cupones restados**, menos el cashback que se haya aplicado.

**Por qué:** el total del pedido es un snapshot inmutable — es lo que el operador va a cobrar por WhatsApp. Recalcular la base desde las líneas abriría la puerta a que el cashback se calcule sobre un número distinto del que se cobró.

**Nota para el change de redención:** cuando exista, el importe pagado con saldo tendrá que quedar registrado en el pedido para poder restarlo aquí. Hoy es cero, así que la fórmula ya es correcta.

### 5. El vencimiento es un movimiento, no un borrado

**Decisión:** vencer un lote escribe un movimiento negativo por su remanente y lo deja en cero. El lote no se borra ni se edita.

**Por qué:** si venciera borrando, el libro dejaría de explicar el saldo, y un cliente que dice "yo tenía cashback" no tendría respuesta. Con el movimiento se sabe cuánto venció, cuándo y de qué compra venía — que es exactamente lo que se necesita para responderle.

### 6. "Pendiente" se calcula, no se guarda

**Decisión:** el cashback pendiente se deriva de los pedidos del cliente que están creados y sin confirmar. No genera movimientos ni lotes.

**Por qué:** guardar lotes pendientes obligaría a limpiarlos cuando el pedido expira, y un pedido expirado que dejara su lote sería saldo fantasma. Derivándolo, la expiración lo hace desaparecer sin que nadie tenga que acordarse.

Es la misma decisión que se tomó con el estado de los cupones: **lo que se puede derivar no se guarda**.

## Dónde vive cada cosa

```
src/modules/cashback/
  ledger.ts     acreditar, consumir por antigüedad, vencer — con su materialización
  accrual.ts    la base de cálculo y el redondeo
  balance.ts    saldo disponible por moneda y pendiente derivado
  verify.ts     comprobación de que el saldo cuadra con el libro
src/modules/events/handlers/order-confirmed-cashback.ts
src/modules/jobs/definitions.ts   (modificado) trabajo de vencimiento
tests/cashback.test.ts
```

**Migración de Prisma:** sí. Se retira el modelo de puntos y entra el libro de cashback. **No hay datos que migrar**: el módulo de KoraPuntos nunca llegó a construirse.

**Eventos:** consume `order.confirmed`. No emite ninguno.

**Pantallas:** solo se sustituye el bloque de saldo del perfil del cliente, que hoy muestra cero.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Acreditar dos veces es regalar dinero**, y el error no se reporta: nadie reclama que le den de más. | Idempotencia contra el propio libro, fijada por prueba, siguiendo el patrón ya demostrado por el worker. |
| **El saldo materializado se desincroniza del libro.** | Misma transacción siempre, más un trabajo de verificación que **avisa y no corrige** — igual que el del inventario: un libro descuadrado es un síntoma, y arreglarlo solo borra la evidencia. |
| **El vencimiento no corre y el cashback vive para siempre.** Es dinero que el negocio creía haber recuperado. | Trabajo programado con su registro de ejecuciones; `jobs:status` responde cuánto hace que corrió bien por última vez. |
| **La base de cálculo cambia cuando exista la redención.** | La fórmula ya contempla restar el cashback aplicado; hoy vale cero. Queda anotado dónde se conecta. |
| **Los saldos por moneda se suman por descuido** en alguna pantalla futura. | El tipo del saldo no es un número: es un valor por moneda, así que sumarlos no compila sin decidirlo a propósito. |

## Migration Plan

1. Migrar el esquema: fuera el modelo de puntos, dentro el libro de cashback.
2. Libro, cálculo y verificación **con sus pruebas, antes de conectar nada**.
3. Registrar el manejador en el worker y el trabajo de vencimiento.
4. Sustituir el cero del perfil del cliente por el saldo real.
5. Verificar de punta a punta: confirmar un pedido y ver el saldo aparecer.

**Reversión:** desregistrar el manejador detiene la acreditación sin tocar lo ya acreditado. El libro es append-only: nada de lo escrito se pierde.

## Open Questions

- **Si el recálculo por cambio de producto sube el cashback, ¿se acredita la diferencia?** Pendiente del cliente. No bloquea este change —la acreditación inicial es independiente— pero define un tipo de movimiento más.
- **Cuándo avisar al cliente de que su cashback va a vencer.** Es del módulo de correo (S13) y necesita que el dominio tenga registros de correo, que hoy no tiene.
