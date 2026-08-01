# email-delivery Specification

## Purpose
Cómo sale un correo de KORA: un solo camino, dos implementaciones, y la garantía de que nadie reciba dos veces el mismo envío.
## Requirements
### Requirement: El envío pasa por una sola interfaz con dos implementaciones

Todo correo SHALL salir por la misma interfaz. En desarrollo SHALL usarse un driver que **escribe el correo a disco** en vez de enviarlo; en producción, el del proveedor.

**Invariante:** es la misma forma que resolvió el almacenamiento de imágenes, y por el mismo motivo. Sin un driver de desarrollo no hay manera de trabajar en el módulo —ni de probarlo— sin una cuenta de proveedor y un dominio verificado, que hoy no existen. Y escribir el correo a disco, en vez de solo registrar que se envió, permite **abrirlo y leerlo**: un correo roto se ve, no se deduce.

#### Scenario: Desarrollo sin proveedor

- **WHEN** se envía un correo en desarrollo
- **THEN** queda un archivo legible con su destinatario, asunto y contenido, y el envío se reporta como correcto

#### Scenario: Producción con proveedor

- **WHEN** se envía un correo en producción con el proveedor configurado
- **THEN** se entrega por el proveedor y se registra su identificador de mensaje

#### Scenario: El proveedor falla

- **WHEN** el proveedor rechaza o no responde
- **THEN** el envío se reporta como fallido con su motivo, y no se marca al destinatario como enviado

### Requirement: Sin proveedor configurado, en producción la aplicación no arranca

En producción, si falta la configuración del proveedor de correo, la aplicación SHALL **negarse a arrancar**, indicando qué variable falta.

**Invariante:** es la lección que ya costó una vez con las imágenes. Una comprobación perezosa deja el contenedor **reportándose sano** con el módulo roto, y el fallo aparece cuando alguien lanza la primera campaña —es decir, delante del cliente— en vez de cuando se despliega. En desarrollo no aplica: ahí el driver de disco funciona sin configurar nada.

#### Scenario: Producción sin configurar

- **WHEN** la aplicación arranca en producción sin la configuración del proveedor
- **THEN** falla inmediatamente diciendo qué variables faltan

#### Scenario: Desarrollo sin configurar

- **WHEN** la aplicación arranca en desarrollo sin configuración de proveedor
- **THEN** arranca con normalidad y usa el driver de disco

### Requirement: Un destinatario no recibe dos veces el mismo envío

Cada destinatario de una campaña SHALL recibirla **como máximo una vez**, aunque el envío se reanude tras una caída o el despachador se ejecute dos veces a la vez.

**Invariante:** un correo duplicado no se puede deshacer. Le llega al comprador, lo lee como descuido y —peor— las quejas de spam que genera queman la reputación del dominio justo cuando se está construyendo. La garantía SHALL vivir en la base de datos y no solo en la comprobación del código: leer el estado de un destinatario no es reservarlo.

#### Scenario: Reanudación tras una caída

- **WHEN** el proceso muere a mitad de una campaña y el despachador vuelve a correr
- **THEN** solo se envía a quienes aún no habían recibido, y nadie recibe dos veces

#### Scenario: Dos despachadores a la vez

- **WHEN** dos ejecuciones del despachador toman la misma campaña
- **THEN** ningún destinatario se procesa dos veces

#### Scenario: Fallo de un destinatario

- **WHEN** el envío a un destinatario falla
- **THEN** queda marcado como fallido con su motivo y **no bloquea** al resto del lote

### Requirement: La plantilla de la vista previa y la del envío son la misma

El contenido de un correo SHALL renderizarse con **un único generador**: lo que el operador ve en la vista previa es lo que se envía.

Todo correo de campaña SHALL incluir versión HTML y versión de **texto plano**.

**Invariante:** dos generadores se desincronizan, y aquí el error se descubre después de enviarle a diez mil personas. La versión de texto plano no es un extra: su ausencia es una de las señales que los filtros de spam usan para clasificar un correo, y este dominio todavía no tiene reputación que lo compense.

#### Scenario: Vista previa

- **WHEN** el operador ve la vista previa de una campaña
- **THEN** es el mismo HTML que recibirá el destinatario

#### Scenario: Cliente de correo sin HTML

- **WHEN** el correo se abre en un cliente que no renderiza HTML
- **THEN** el contenido se lee igualmente en texto plano

### Requirement: El correo no expone datos de otros compradores

Un correo de campaña SHALL dirigirse a **un solo destinatario** y NO SHALL incluir direcciones de otros compradores en ningún encabezado visible.

**Invariante:** enviar una campaña con todos los destinatarios en copia es la filtración de datos personales más común que existe, y en Colombia es una infracción de la Ley 1581 con la lista completa de clientes del negocio dentro.

#### Scenario: Envío de una campaña

- **WHEN** se envía una campaña a varios destinatarios
- **THEN** cada uno recibe un correo dirigido solo a él

### Requirement: El correo de prueba no consume audiencia ni métricas

Enviar un correo de prueba SHALL entregarlo a la dirección indicada **sin** crear destinatarios, sin alterar contadores y sin cambiar el estado de la campaña.

#### Scenario: Prueba antes de enviar

- **WHEN** el operador envía una prueba de un borrador
- **THEN** recibe el correo y la campaña sigue en borrador, sin destinatarios ni métricas

