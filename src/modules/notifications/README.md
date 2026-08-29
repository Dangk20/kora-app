# Correos transaccionales del pedido

Lo que KORA le escribe al comprador y al operador en cada momento de la compra.
Requisitos: `openspec/changes/correos-transaccionales/specs/`.

⚠️ **Esto es alcance NUEVO**, fuera de la cotización: el alcance §6 solo pidió
campañas de email masivo. Ver `openspec/changes/correos-transaccionales/proposal.md`.

## Las dos listas

Hasta este módulo el sistema tenía una sola idea de "no enviar", y son dos:

| | Qué significa | Frena campañas | Frena comprobantes |
|---|---|:--:|:--:|
| **Baja de marketing** (`acceptsMarketing`) | "No me mandes promociones" | ✅ | ❌ |
| **Dirección no utilizable** (`emailUsable`) | "Aquí no vive nadie" | ✅ | ✅ |

Confundirlas rompe en las dos direcciones. Tratar la baja como supresión le
niega su comprobante a quien solo rechazó publicidad — y en una tienda donde el
pago se cierra por WhatsApp, ese correo es su única constancia y su único camino
de vuelta. Tratar la supresión como baja nos deja escribiendo a buzones muertos,
que es lo que hunde la reputación del dominio y hace que deje de llegar el
correo de todos los demás.

Vive en `guard.ts`, en un solo sitio, para que la diferencia no quede repartida.

## Nada se envía desde la acción

`createOrder()` y `confirmOrder()` **no llaman al correo**. Escriben su evento en
la bandeja de salida, dentro de su misma transacción, y el worker envía.

Enviar desde la acción ataría la venta a que un tercero responda: un proveedor
lento convertiría el checkout en una espera y uno caído, en una venta perdida.
Perder la venta porque no salió el correo es cambiar un problema pequeño por el
peor de todos. **Hay una prueba que lo fija**, comprobando que esos archivos no
importan el módulo de envío — por si alguien "simplifica" mañana.

Los eventos se llaman `order.created`, `order.preparing`, `order.shipped`,
`order.delivered`, `order.cancelled`: lo que pasó en el negocio, no lo que se
quiere hacer con ello. Mañana puede colgar de ahí un aviso por WhatsApp sin
tocar a quien lo emite.

## Se reserva antes de enviar

`send.ts` inserta la fila del envío **antes** de entregar al proveedor. El índice
único `(pedido, tipo)` es la garantía; la comprobación previa solo evita trabajo.

Si se enviara primero, un fallo entre medias haría que el reintento volviera a
enviar. Reservando antes, el peor caso es que alguien **no** reciba un correo, no
que lo reciba dos veces — un comprador que recibe dos confirmaciones duda de si
compró dos veces, y un operador que recibe dos avisos deja de mirarlos.

Cuando el proveedor falla, la fila se conserva pero **se suelta la marca de
intento**: sin eso, la protección contra duplicados se comería el envío y el
correo no saldría nunca.

## Los correos

**Uno por cada estado del pedido** — decisión del cliente (1 ago 2026). Se había
propuesto avisar solo en los momentos "importantes"; la respuesta fue la
contraria, y el motivo es bueno: el comprador no tiene otra ventana a su pedido,
así que cada cambio sin avisar es una pregunta por WhatsApp que alguien contesta
a mano.

| Tipo | Para | Qué lleva |
|---|---|---|
| `BUYER_CREATED` | Comprador | Resumen y **enlace de WhatsApp** para cerrar el pago |
| `BUYER_CONFIRMED` | Comprador | Pago confirmado, cashback ganado y su vencimiento |
| `BUYER_PREPARING` | Comprador | Ya lo estamos armando |
| `BUYER_SHIPPED` | Comprador | Va en camino |
| `BUYER_DELIVERED` | Comprador | Entregado, con el cashback y la **ventana de cambios de 30 días** |
| `BUYER_CANCELLED` | Comprador | Cancelado o expirado, con el cashback devuelto |
| `BUYER_PAYMENT_REMINDER` | Comprador | A una hora de vencer: todavía puedes confirmar |
| `STAFF_NEW_ORDER` | Equipo | Enlace directo al pedido en el panel |

El evento de cada estado se escribe **dentro de la transacción** que lo cambia
(`EVENTO_POR_ESTADO` en `orders/actions.ts`), así que una transición rechazada
por la máquina de estados no genera correo. Si mañana se añade un estado nuevo,
hay que añadirlo a ese mapa — una prueba comprueba que todos los eventos tienen
manejador registrado.

El del comprador va a `contactEmail` **del pedido**, no a la ficha del cliente:
el pedido guarda su propio snapshot, y si el cliente cambia de correo después,
el pedido despachado conserva el suyo.

Ninguno lleva enlace de baja. Ofrecerlo en un comprobante promete algo que no se
va a cumplir —el siguiente pedido generará su correo igual— y marca el mensaje
como comercial ante los filtros.

## Comandos

```bash
pnpm staff:email pedidos@korashopp.com  # a dónde llegan los avisos de pedido nuevo
pnpm staff:email --ver
pnpm emails:preview                     # escribe un ejemplo de cada correo a .emails/
```

**Sin dirección del negocio configurada, el aviso se omite dejando constancia en
el historial del pedido** — nunca falla la venta, pero tampoco calla: un negocio
que no recibe avisos tiene que poder enterarse.

## El bloqueo

**No sale ni un correo todavía:** `korashopp.com` no tiene SPF, DKIM ni DMARC y
no hay cuenta de proveedor. Insumo del cliente desde el 31 jul.

Mientras tanto todo funciona contra disco: `pnpm emails:preview` genera los ocho
en `.emails/` y se abren con doble clic, así que **el cliente puede aprobarlos
antes de que el dominio exista**. Activar el envío es configuración, no
desarrollo.

## El octavo correo es distinto a los otros siete

`BUYER_PAYMENT_REMINDER` **no nace de un cambio de estado**. A una hora de que el
pedido expire, el estado sigue siendo `PENDING` —no ha cambiado nada— y sin
embargo hay algo que decir. Por eso no vive en `EVENTO_POR_ESTADO` sino en un
trabajo programado (`orders:payment-reminder`, cada 10 min) que va a buscarlos.

**La ventana se ancla en `expiresAt`, nunca en `createdAt`.** Escribir "pedidos
creados hace más de 23 horas" repite la vigencia en un segundo sitio: si mañana
el cliente pide 48 h, ese 23 se queda obsoleto en silencio y el recordatorio
empieza a llegar a mitad de la ventana sin que nada falle. Anclado en el
vencimiento, "una hora antes" sigue siendo una hora antes aunque la vigencia
cambie.

**La antelación también se deriva** (`leadTimeMs`): una hora, acotada a la mitad
de la vigencia. Con una vigencia de 30 minutos, "una hora antes" caería en el
pasado y **todo** pedido entraría en la ventana nada más crearse — el
recordatorio se convertiría en un segundo correo inmediato.

**Que un pedido caiga en varias pasadas no importa.** Quien garantiza que el
correo salga una vez es la reserva —índice único `(pedido, tipo, destinatario)`—,
no la ventana. El filtro que salta los que ya tienen fila es una optimización,
no la garantía: leer no es reservar.

**No toca el pedido.** Recordar y vencer son trabajos distintos; si este
cambiara estados, un fallo suyo se convertiría en pedidos cancelados por error.

## A quién llega el aviso de pedido nuevo

Al correo configurado del negocio (`pnpm staff:email`) **más todos los usuarios
con rol `admin` que estén activos**, sin repetidos. Solo administradores: un
cajero atiende pedidos pero no tiene por qué recibir en su correo personal el
aviso de cada venta.

Cada destinatario tiene **su propia reserva**, así que una dirección que rebota
no deja sin aviso a las demás, y al reintentar quien ya recibió no recibe otra
vez.
