# email-campaigns Specification

## Purpose
La campaña: qué se dice, a quién le llega, cuándo sale y qué queda registrado de lo que pasó.
## Requirements
### Requirement: El estado de la campaña gobierna lo que se puede hacer con ella

Una campaña SHALL moverse por los estados **Borrador → Programada → Enviando → Enviada**, más **Cancelada** desde Programada. Las transiciones SHALL ser las únicas permitidas y el estado NUNCA SHALL retroceder.

Una campaña **Enviando** o **Enviada** NO SHALL poder editarse ni eliminarse; solo verse y duplicarse.

**Invariante:** editar una campaña que ya está saliendo produce dos correos distintos bajo el mismo nombre, y ya no hay forma de saber qué recibió cada quien. Y no se puede cancelar lo que ya salió: el botón mentiría. Es el mismo criterio que gobierna el estado de un pedido.

#### Scenario: Cancelar una programada

- **WHEN** el operador cancela una campaña programada antes de su hora
- **THEN** pasa a Cancelada y no se envía

#### Scenario: Intentar cancelar una que ya salió

- **WHEN** se intenta cancelar una campaña en Enviando
- **THEN** se rechaza, porque los correos ya están saliendo

#### Scenario: Duplicar una enviada

- **WHEN** el operador duplica una campaña enviada
- **THEN** se crea un **borrador nuevo** con el mismo contenido, y la original no se toca

### Requirement: Una campaña solo puede empezar a enviarse una vez

El paso a **Enviando** SHALL ser idempotente: dos disparos simultáneos SHALL producir un solo envío.

**Invariante:** el disparo puede venir del operador y del trabajo programado a la vez —una campaña programada cuyo operador además pulsa "Enviar ahora"—. Si los dos ganaran, cada destinatario recibiría dos correos. La garantía SHALL estar en la base, no en una comprobación previa: leer el estado no lo reserva.

#### Scenario: Doble disparo

- **WHEN** dos procesos intentan iniciar el envío de la misma campaña a la vez
- **THEN** uno lo consigue y el otro no hace nada

### Requirement: La audiencia se congela al iniciar el envío

Al pasar a Enviando, la lista de destinatarios SHALL **fijarse y registrarse**, con el correo de cada uno tal como estaba en ese momento.

En Borrador y Programada, el número mostrado SHALL ser un **estimado vigente**, y decirse como tal.

**Invariante:** sin lista congelada no se puede responder "¿a quién le llegó?", que es la pregunta que se hace cuando alguien se queja. Y el correo se guarda copiado porque el cliente puede corregirlo después: el registro tiene que decir a dónde se envió de verdad, no a dónde se enviaría hoy.

#### Scenario: Estimado en borrador

- **WHEN** el operador ajusta los filtros de un borrador
- **THEN** el número de destinatarios se actualiza y se presenta como estimado

#### Scenario: Congelado al enviar

- **WHEN** la campaña pasa a Enviando
- **THEN** queda registrado exactamente a quién se envía y con qué correo

#### Scenario: Programada que se dispara más tarde

- **WHEN** llega la hora de una campaña programada
- **THEN** la audiencia se **recalcula** con los filtros guardados: entra quien se suscribió después y sale quien se dio de baja

### Requirement: El contenido se congela al enviarse

El contenido de la campaña —textos, imagen y productos destacados con su precio— SHALL guardarse como **copia inmutable** al iniciar el envío.

**Invariante:** un producto que cambia de precio o desaparece del catálogo no puede alterar un correo ya enviado. El correo es una promesa comercial hecha: el registro tiene que poder mostrar qué decía exactamente.

Si un producto destacado desaparece del catálogo **antes** del envío, SHALL retirarse de la campaña avisando al operador, en vez de enviar un enlace roto.

#### Scenario: Cambio de precio después de enviar

- **WHEN** un producto destacado cambia de precio después del envío
- **THEN** el detalle de la campaña sigue mostrando el precio que se envió

#### Scenario: Producto eliminado antes del envío

- **WHEN** un producto destacado se elimina del catálogo con la campaña en borrador
- **THEN** se retira del contenido y se avisa al operador

### Requirement: Los precios del correo salen de la única fuente de precios

Los precios de los productos destacados SHALL resolverse con `resolvePrice()`, nunca calculados dentro del correo.

Si la audiencia es de **un solo país**, los productos SHALL mostrarse en la moneda de ese país. Si es **mixta**, SHALL mostrarse **sin precio**, con un enlace a la ficha.

**Invariante:** no existe tasa de cambio en KORA y es deliberado. Un correo que muestre un precio único a una audiencia de dos países estaría mintiéndole a la mitad, y el operador se enteraría cobrando.

#### Scenario: Audiencia solo Colombia

- **WHEN** la audiencia son clientes de Colombia
- **THEN** los productos se muestran con su precio en pesos, con el tachado del precio online solo si hay ahorro real

#### Scenario: Audiencia mixta

- **WHEN** la audiencia incluye Colombia y Estados Unidos
- **THEN** los productos se muestran sin precio, con enlace a la ficha

### Requirement: La segmentación combina filtros y se puede contar antes de enviar

La audiencia SHALL construirse con filtros combinables por **país**, **actividad** (basada en pedidos confirmados), **cuenta** y **categoría comprada**, aplicados en intersección.

El panel SHALL mostrar el **conteo de destinatarios** antes de enviar.

**Invariante:** enviar a toda la base es la forma más rápida de que la gente se dé de baja. Y el conteo antes de enviar es el único freno que tiene el operador: sin él, la diferencia entre segmentar bien y enviar a todos no se ve hasta después.

#### Scenario: Filtros combinados

- **WHEN** se eligen "Colombia" y "compradores de Tecnología"
- **THEN** la audiencia son quienes cumplen **ambas** condiciones

#### Scenario: Segmento vacío

- **WHEN** los filtros no dejan ningún destinatario
- **THEN** se dice claramente y no se permite enviar

### Requirement: El envío no degrada la tienda

El envío SHALL ejecutarse **fuera del proceso que atiende la tienda**, por lotes acotados y con pausa entre ellos.

**Invariante:** es el DoD de la semana 13. Una campaña de diez mil correos que se procesara dentro de una petición dejaría la tienda sin responder justo cuando la campaña empieza a traer visitas — el peor momento posible.

#### Scenario: Campaña grande

- **WHEN** se envía una campaña de miles de destinatarios
- **THEN** se procesa en lotes sucesivos sin bloquear la tienda ni el panel

#### Scenario: Reanudación

- **WHEN** el envío se interrumpe a mitad
- **THEN** la siguiente ejecución continúa por donde iba

### Requirement: La campaña reporta lo que sabe y no inventa lo que no

El detalle de una campaña SHALL mostrar **enviados**, **fallidos** y **desuscripciones generadas**.

Las métricas que dependen del proveedor —entregas confirmadas, aperturas, clics y rebotes— SHALL mostrarse como **no disponibles**, con el motivo, mientras el proveedor no esté configurado.

**Invariante:** un cero es indistinguible de "nadie abrió el correo", y esa lectura hace tomar decisiones comerciales equivocadas sobre datos que no existen. Decir "todavía no medimos esto, y por qué" es información; un cero es ruido.

#### Scenario: Sin proveedor configurado

- **WHEN** se ve el detalle de una campaña enviada sin proveedor configurado
- **THEN** enviados y fallidos muestran su número real, y aperturas y clics dicen que no están disponibles todavía

