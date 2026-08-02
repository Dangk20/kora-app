## Purpose

Que el comprador tenga constancia de su compra y el operador se entere de que vendió, sin que el correo pueda estropear la venta ni llegar dos veces.

## ADDED Requirements

### Requirement: Un correo transaccional NO obedece la baja de marketing

Los correos del ciclo del pedido SHALL enviarse **aunque el destinatario se haya dado de baja** de las comunicaciones comerciales.

**Invariante:** son mensajes de servicio, no publicidad. Quien rechazó promociones no rechazó su comprobante de compra: negárselo lo deja sin el número de pedido, sin el detalle de lo que pagó y sin el camino de vuelta a WhatsApp para cerrar el cobro. En una tienda donde el pago ocurre fuera de la plataforma, ese correo es la única constancia que tiene.

#### Scenario: Comprador dado de baja de promociones

- **WHEN** alguien que se dio de baja hace un pedido
- **THEN** recibe igual los correos de su pedido

#### Scenario: Comprador nunca suscrito

- **WHEN** compra alguien que jamás aceptó recibir promociones
- **THEN** recibe igual los correos de su pedido

### Requirement: Un correo transaccional SÍ obedece la supresión de la dirección

Si la dirección quedó marcada como no utilizable —rebote duro o queja—, NO SHALL enviarse ningún correo a ella, ni siquiera transaccional, y el hecho SHALL quedar registrado.

**Invariante:** son dos listas distintas y hasta hoy había una sola. La baja de marketing dice *"no me mandes promociones"*; la supresión dice *"esta dirección no existe"*. Insistir sobre una dirección muerta no entrega nada y sí daña la reputación del dominio, que es justo lo que hace que los correos de los demás compradores dejen de llegar.

#### Scenario: Dirección que rebotó

- **WHEN** un comprador cuya dirección rebotó hace un pedido
- **THEN** no se le envía correo y queda constancia del motivo

#### Scenario: Pedido sin correo del comprador

- **WHEN** un pedido no tiene dirección de correo
- **THEN** no se intenta enviar nada y no se trata como un error

### Requirement: El correo nunca rompe la venta

El envío SHALL ocurrir **fuera del camino crítico**: `createOrder()` y `confirmOrder()` NO SHALL fallar, demorarse ni deshacerse porque el proveedor de correo esté caído, lento o sin configurar.

**Invariante:** perder una venta porque no salió un correo es cambiar un problema pequeño por el peor de todos. El pedido se escribe con su evento en la misma transacción; el envío ocurre después, con reintentos, y su fracaso es visible en el diagnóstico en vez de propagarse al comprador.

#### Scenario: Proveedor caído al crear el pedido

- **WHEN** el proveedor de correo no responde y un comprador finaliza su pedido
- **THEN** el pedido se crea normalmente y el comprador ve su pantalla de éxito

#### Scenario: Proveedor caído al confirmar

- **WHEN** el operador confirma un pedido y el envío falla
- **THEN** el stock se descuenta, el estado cambia y el cashback se acredita igual

#### Scenario: Reintento posterior

- **WHEN** el proveedor vuelve a estar disponible
- **THEN** los correos pendientes se envían sin intervención

### Requirement: El mismo correo no se envía dos veces

Cada correo SHALL enviarse **como mucho una vez** por pedido y tipo. Reprocesar el mismo evento NO SHALL producir un segundo envío.

**Invariante:** la entrega de la bandeja de salida es *al menos una vez*, así que un evento puede llegar dos veces. Un comprador que recibe dos confirmaciones duda de si hizo dos pedidos; un operador que recibe dos avisos de "pedido nuevo" empieza a ignorarlos, y el día que llegue uno de verdad no lo verá. La garantía SHALL estar en la base, no en una comprobación previa: leer no es reservar.

El registro SHALL escribirse **antes** de entregar al proveedor. Si algo falla en medio, el peor caso SHALL ser que alguien no reciba un correo, nunca que lo reciba dos veces.

#### Scenario: Evento entregado dos veces

- **WHEN** el mismo evento del pedido se procesa dos veces
- **THEN** el correo salió una sola vez

#### Scenario: Dos trabajadores a la vez

- **WHEN** dos procesos intentan enviar el mismo correo simultáneamente
- **THEN** uno lo envía y el otro no hace nada

#### Scenario: Fallo del proveedor tras reservar

- **WHEN** se registra el envío y el proveedor falla
- **THEN** el correo se reintenta sin duplicar el registro

### Requirement: El comprador recibe los momentos de su pedido

SHALL enviarse al comprador un correo cuando su pedido: **se crea**, **se confirma**, **se envía** y **se cancela o expira**.

El de creación SHALL incluir el número de pedido, el detalle de lo comprado, el total en **su moneda** y el **enlace de WhatsApp** para retomar el pago. El de confirmación SHALL indicar el cashback acreditado y cuándo vence. El de cancelación SHALL indicar el cashback devuelto, si lo hubo.

**Invariante:** el pago se acuerda por WhatsApp, fuera de la plataforma. Sin el enlace en el correo, un comprador que cerró la pestaña no tiene forma de volver — y su pedido expira en dos horas. El correo de creación no es un acuse: es el camino de vuelta a la venta.

#### Scenario: Pedido recién creado

- **WHEN** un comprador finaliza su pedido
- **THEN** recibe el resumen con su número y el enlace para continuar por WhatsApp

#### Scenario: Pedido confirmado con cashback

- **WHEN** el operador confirma un pedido que generó cashback
- **THEN** el comprador recibe la confirmación con el importe acreditado y su vencimiento

#### Scenario: Pedido expirado

- **WHEN** un pedido pendiente expira sin confirmarse
- **THEN** el comprador recibe el aviso, con su cashback devuelto si había aplicado

#### Scenario: Importes en la moneda del pedido

- **WHEN** el pedido es en dólares
- **THEN** todos los importes del correo salen en dólares, sin conversión

### Requirement: El operador se entera de cada pedido nuevo

SHALL enviarse un aviso a la dirección del negocio cuando se crea un pedido, con el número, el cliente, el total y el **enlace directo al pedido en el panel**.

La dirección de destino SHALL ser configurable, y si no está configurada el aviso SHALL omitirse **dejando constancia**, no fallar.

**Invariante:** un pedido pendiente vive dos horas. Si nadie lo ve, la venta se cae sola — y el operador no tiene por qué estar mirando el panel. Este aviso es lo que convierte el pedido en una llamada.

Falla en silencio no: si la dirección no está puesta, el negocio está perdiendo avisos y tiene que poder enterarse.

#### Scenario: Pedido nuevo con dirección configurada

- **WHEN** entra un pedido
- **THEN** el operador recibe el aviso con el enlace al pedido

#### Scenario: Dirección del negocio sin configurar

- **WHEN** entra un pedido y no hay dirección configurada
- **THEN** no se envía nada, queda registrado el motivo, y el pedido se crea igual

### Requirement: Los correos transaccionales se distinguen de las campañas

Un correo transaccional NO SHALL llevar enlace de baja ni la cabecera de desuscripción, y SHALL usar la plantilla de marca.

**Invariante:** ofrecer "date de baja" en una factura promete algo que no se va a cumplir —el siguiente pedido volverá a generar su correo— y además marca el mensaje como comercial ante los filtros. La plantilla se comparte porque lo que el cliente aprueba visualmente tiene que ser lo que sale.

#### Scenario: Correo de pedido

- **WHEN** se genera un correo del ciclo del pedido
- **THEN** no ofrece darse de baja

#### Scenario: Correo de campaña

- **WHEN** se genera un correo de campaña
- **THEN** sigue llevando su enlace de baja, obligatorio
