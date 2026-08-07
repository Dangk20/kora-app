## Purpose

La creación del respaldo de la base de datos: cuándo se toma, cómo se cifra antes de salir del servidor, dónde se envía, cuánto se conserva, y cómo se detecta que dejó de ocurrir.

## ADDED Requirements

### Requirement: El respaldo se toma sin depender de la red interna

El volcado SHALL obtenerse ejecutando `pg_dump` **dentro del contenedor de la base**, invocado desde el anfitrión. NO SHALL requerir que el proceso de respaldo esté conectado a la red interna del entorno.

La red interna es `internal: true` a propósito: la base no tiene salida a internet. Un proceso de respaldo conectado a ella no podría enviar nada a ningún sitio, y darle salida anularía la propiedad que ese aislamiento defiende — la base dejaría de estar incomunicada.

#### Scenario: El respaldo se ejecuta con la base aislada

- **WHEN** se lanza el respaldo con la base en una red sin salida a internet
- **THEN** el volcado se obtiene correctamente y se envía al destino remoto

#### Scenario: La base no está disponible

- **WHEN** se lanza el respaldo y el contenedor de la base no responde
- **THEN** el proceso termina con código distinto de cero, sin dejar ningún archivo parcial en el destino

### Requirement: El respaldo se cifra antes de salir del servidor

El volcado SHALL cifrarse **en el anfitrión**, antes de cualquier envío. En ningún momento SHALL escribirse en el destino remoto un volcado sin cifrar.

El cifrado SHALL ser **asimétrico**: el servidor lleva únicamente la clave pública. El servidor SHALL poder crear respaldos y NO SHALL poder descifrarlos.

Si alguien compromete el servidor, hoy se llevaría además el histórico completo de respaldos —datos personales, teléfonos, direcciones y el libro de cashback de todos los clientes—. Con clave pública se lleva archivos que no puede abrir. La contrapartida es real y se asume: **perder la clave privada hace los respaldos irrecuperables**.

#### Scenario: Contenido del archivo enviado

- **WHEN** se completa un respaldo
- **THEN** el archivo enviado al destino está cifrado, y su contenido no revela en claro ningún nombre de tabla, correo ni teléfono

#### Scenario: El servidor no puede leer sus propios respaldos

- **WHEN** se intenta descifrar un respaldo usando únicamente lo que hay en el servidor
- **THEN** la operación falla por falta de clave privada

#### Scenario: Sin clave pública configurada no se hace nada

- **WHEN** se lanza el respaldo sin clave pública de cifrado configurada
- **THEN** el proceso termina con error **antes** de volcar la base, y no deja ningún archivo sin cifrar en el disco

### Requirement: El respaldo no deja rastro sin cifrar en el disco

Los archivos temporales del proceso SHALL eliminarse al terminar, **también cuando el proceso falla o se interrumpe**.

Un volcado sin cifrar olvidado en `/tmp` anula el cifrado: quien entre al servidor lo encuentra ahí.

#### Scenario: El envío falla a mitad

- **WHEN** el envío al destino remoto falla después de generar el volcado
- **THEN** el proceso termina con error y no queda en el disco ningún archivo con el volcado, cifrado o no

#### Scenario: El proceso se interrumpe

- **WHEN** el proceso recibe una señal de terminación mientras trabaja
- **THEN** limpia sus archivos temporales antes de salir

### Requirement: Se conservan 30 días y se elimina lo anterior

El sistema SHALL conservar los respaldos de los últimos 30 días y SHALL eliminar los más antiguos.

El borrado SHALL ocurrir **después** de confirmar que el respaldo del día se envió correctamente. Borrar primero dejaría al negocio, durante unos segundos, con un respaldo menos y ninguno nuevo.

#### Scenario: Rotación con envío correcto

- **WHEN** el respaldo del día se envía correctamente y existen respaldos de más de 30 días
- **THEN** los anteriores a 30 días se eliminan y los recientes se conservan

#### Scenario: Rotación con envío fallido

- **WHEN** el envío del respaldo del día falla
- **THEN** NO se elimina ningún respaldo anterior

### Requirement: Un respaldo que dejó de ocurrir se detecta

El sistema SHALL permitir comprobar cuándo se completó el último respaldo correcto, y SHALL señalar como fallo la ausencia de un respaldo dentro de la ventana esperada.

Es el modo de fallo más peligroso de cualquier sistema de copias: dejar de correr no produce ningún error. Todo sigue funcionando, nadie recibe una alerta, y el problema aparece el día que se necesita restaurar.

#### Scenario: Respaldo al día

- **WHEN** se consulta el estado y el último respaldo correcto es de hace menos de 48 horas
- **THEN** el estado es correcto e informa la fecha y el tamaño del último respaldo

#### Scenario: El respaldo lleva días sin correr

- **WHEN** se consulta el estado y el último respaldo correcto tiene más de 48 horas
- **THEN** el estado es de fallo e informa cuánto tiempo lleva sin respaldo

#### Scenario: Nunca ha corrido

- **WHEN** se consulta el estado y no existe ningún respaldo
- **THEN** el estado es de fallo, y lo distingue explícitamente de "el respaldo está atrasado"

### Requirement: El respaldo no interrumpe la operación de la tienda

El volcado SHALL tomarse de forma que no bloquee las escrituras de la aplicación mientras se ejecuta.

#### Scenario: Compra durante el respaldo

- **WHEN** un comprador crea un pedido mientras el respaldo está en curso
- **THEN** el pedido se crea con normalidad, sin esperar a que el respaldo termine
