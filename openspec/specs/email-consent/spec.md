# email-consent Specification

## Purpose
Quién puede recibir correo de KORA: consentimiento registrado, baja de un clic y una lista que se limpia sola.
## Requirements
### Requirement: Solo recibe campañas quien está suscrito y tiene un correo utilizable

La audiencia de una campaña SHALL excluir, **sin excepción**, a quien se dio de baja y a quien tiene el correo marcado como no utilizable.

La exclusión SHALL aplicarse **dos veces**: al construir la audiencia y otra vez **al enviar cada lote**.

**Invariante:** entre que se arma una audiencia y que sale el último lote pueden pasar horas. Alguien que se da de baja en ese intervalo y aun así recibe el correo tiene razón en quejarse, y esa queja va directa contra la reputación del dominio. Comprobarlo dos veces cuesta una consulta por lote; no comprobarlo cuesta el canal.

#### Scenario: Baja durante el envío

- **WHEN** un destinatario se da de baja con la campaña a medio enviar
- **THEN** no recibe el correo, aunque estuviera en la lista congelada

#### Scenario: Correo marcado como no utilizable

- **WHEN** un cliente tiene el correo marcado tras un rebote duro
- **THEN** queda fuera de toda campaña futura

#### Scenario: Cliente sin correo

- **WHEN** un cliente no tiene correo registrado
- **THEN** nunca entra en una audiencia

### Requirement: La baja es de un clic, sin sesión y con efecto inmediato

Todo correo de campaña SHALL llevar un enlace de baja que funcione **sin iniciar sesión**, y el encabezado que permite el botón nativo del cliente de correo.

Un clic SHALL dar de baja y confirmarlo, **en la misma petición**.

**Invariante:** una baja con fricción no evita la baja: la convierte en una queja de spam, que es mucho peor —la queja la registra el proveedor de correo del destinatario y afecta a todos los envíos futuros del dominio—. Facilitar la salida es lo que protege la entrada.

#### Scenario: Clic en el enlace del correo

- **WHEN** el destinatario pulsa "Cancelar suscripción"
- **THEN** queda dado de baja y ve la confirmación, sin escribir nada ni entrar a ninguna cuenta

#### Scenario: Botón nativo del cliente de correo

- **WHEN** el destinatario usa el botón de baja de su gestor de correo
- **THEN** el efecto es el mismo

### Requirement: Nadie puede dar de baja a otro adivinando una dirección

El enlace de baja SHALL usar un **token firmado** por el sistema. Un enlace alterado o inventado NO SHALL surtir efecto.

**Invariante:** si el enlace fuera el identificador del cliente o su correo, cualquiera podría recorrerlos y dar de baja a toda la base — un ataque silencioso que solo se notaría cuando las campañas dejaran de llegar a nadie. Firmar el enlace lo hace infalsificable sin guardar nada extra.

#### Scenario: Enlace legítimo

- **WHEN** llega un enlace de baja generado por el sistema
- **THEN** da de baja al cliente que corresponde

#### Scenario: Enlace manipulado

- **WHEN** llega un enlace con el identificador cambiado o la firma alterada
- **THEN** no surte efecto y no revela si el cliente existe

### Requirement: El cambio de suscripción queda registrado, nunca sobrescrito en silencio

Cada cambio de estado de suscripción SHALL dejar constancia de **cuándo** ocurrió y **por qué vía** (compra, alta manual, baja por enlace, queja de spam, re-suscripción).

**Invariante:** ante un requerimiento sobre datos personales, la pregunta es "¿con qué autorización le escribieron?". Un campo booleano no la responde; un registro con fecha y origen, sí. Y es también lo único que permite distinguir un error del sistema de una decisión del comprador.

#### Scenario: Consentimiento al comprar

- **WHEN** un comprador acepta recibir promociones al hacer un pedido
- **THEN** queda registrado el momento y que el origen fue el checkout

#### Scenario: Baja y vuelta

- **WHEN** un cliente se da de baja y más tarde se re-suscribe
- **THEN** el historial conserva ambos hechos con su fecha

### Requirement: Volver a comprar no re-suscribe a quien se dio de baja

Un cliente dado de baja SHALL seguir dado de baja aunque vuelva a comprar, y el panel NO SHALL poder re-suscribirlo.

La re-suscripción SHALL ser posible **solo por decisión del propio cliente**, desde la página de baja.

**Invariante:** es la protección legal del negocio. Si una compra re-suscribiera, la baja no significaría nada y el cliente que se dio de baja recibiría correo otra vez — que es exactamente lo que la ley prohíbe. Y si el operador pudiera re-suscribir desde el panel, el registro de consentimiento dejaría de valer como prueba.

#### Scenario: Compra de un cliente dado de baja

- **WHEN** un cliente dado de baja hace un pedido nuevo
- **THEN** su pedido se procesa con normalidad y sigue sin recibir campañas

#### Scenario: El panel intenta re-suscribir

- **WHEN** el operador ve un cliente dado de baja
- **THEN** el panel muestra el estado como solo lectura y explica que solo el cliente puede reactivarlo

### Requirement: La lista se limpia sola con lo que informa el proveedor

Un **rebote duro** SHALL marcar el correo como no utilizable. Una **queja de spam** SHALL dar de baja al cliente de inmediato.

Ambos efectos SHALL ser idempotentes: recibir el mismo aviso dos veces SHALL dejar el mismo estado.

**Invariante:** seguir enviando a direcciones que rebotan es la forma más rápida de que un proveedor clasifique el dominio como spam. Y una queja es una petición de baja expresada de la peor manera posible: tratarla como tal es obligatorio, no cortés.

#### Scenario: Rebote duro

- **WHEN** llega un aviso de rebote duro de una dirección
- **THEN** el correo queda marcado como no utilizable y no entra en campañas futuras

#### Scenario: Queja de spam

- **WHEN** llega un aviso de queja de spam
- **THEN** el cliente queda dado de baja con ese origen registrado

#### Scenario: Aviso repetido

- **WHEN** el mismo aviso llega dos veces
- **THEN** el estado no cambia y no se duplica el registro

### Requirement: Todo correo de campaña identifica a quién lo envía y cómo salir

El pie de todo correo de campaña SHALL incluir el nombre del negocio, el enlace a la política de tratamiento de datos y el enlace de baja.

**Invariante:** es obligación legal en Colombia (Ley 1581) y en Estados Unidos (CAN-SPAM), y KORA vende en los dos. Un correo sin pie identificable es, además, exactamente lo que un filtro de spam espera de un correo fraudulento.

#### Scenario: Correo de campaña

- **WHEN** se genera un correo de campaña
- **THEN** su pie identifica al negocio y ofrece la política de datos y la baja

