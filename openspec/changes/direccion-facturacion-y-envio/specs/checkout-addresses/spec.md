## Purpose

Qué datos pide el checkout de quien paga y de quien recibe, en qué país puede estar cada uno, cuándo son la misma dirección y qué queda congelado en el pedido. Modifica PED_HU001 §3: KORA no envía a EE.UU.

## ADDED Requirements

### Requirement: El checkout distingue quién paga de quién recibe

El checkout SHALL pedir dos bloques, titulados **Datos de facturación** (quien paga: contacto y dirección) y **Datos de envío** (quien recibe y dirección de entrega). Los dos SHALL quedar en el pedido como snapshot inmutable, independientes del cliente y de su libreta.

**Invariante:** un pedido siempre sabe a nombre de quién se cobró y a quién se le entrega, aunque sean la misma persona.

#### Scenario: Compra desde Colombia para uno mismo
- **WHEN** el pagador está en Colombia y responde que la entrega es a la misma dirección
- **THEN** el pedido guarda facturación y envío con los mismos datos y queda marcado como "misma dirección"

#### Scenario: Compra desde Estados Unidos para un familiar en Colombia
- **WHEN** el pagador está en EE.UU. y escribe un destinatario en Colombia
- **THEN** el pedido guarda la facturación en EE.UU. (nombre, teléfono +1, correo, dirección con estado y ZIP) y el envío en Colombia (nombre y celular +57 del destinatario, departamento, municipio, dirección, barrio)

#### Scenario: El cliente cambia sus datos después
- **WHEN** el comprador edita su libreta o sus datos de cuenta después de crear el pedido
- **THEN** el pedido conserva la facturación y el envío con los que se creó

### Requirement: La dirección de envío es siempre en Colombia

El bloque de envío SHALL ser el formulario colombiano —departamento (DANE), municipio del departamento elegido, dirección, barrio, complemento opcional y notas— con independencia del país del pagador y de la moneda. El sistema NO SHALL ofrecer entrega en Estados Unidos.

**Invariante:** no existe un pedido con `shipCountry` distinto de `CO` creado después de este cambio.

#### Scenario: Tienda en USD
- **WHEN** un visitante con la tienda en dólares llega al checkout
- **THEN** el bloque de envío pide departamento, municipio y barrio de Colombia, no estado ni ZIP

#### Scenario: Petición que no pasa por el formulario
- **WHEN** llega una petición de crear pedido con país de envío distinto de Colombia
- **THEN** el pedido no se crea y el error señala el bloque de envío

#### Scenario: Municipio fuera del departamento
- **WHEN** la ciudad de envío no es un municipio del departamento elegido
- **THEN** el pedido no se crea y el error señala la ciudad

### Requirement: El país del pagador gobierna su bloque, y arranca desde la moneda

El país del bloque de facturación SHALL arrancar desde la moneda de la sesión (COP → Colombia, USD → Estados Unidos) y SHALL poder cambiarse a mano. Ese país SHALL decidir el prefijo del teléfono del pagador, si se pide documento, los campos de su dirección (departamento y barrio en Colombia; estado y ZIP en EE.UU.) y los métodos de pago ofrecidos.

#### Scenario: Pagador en Colombia
- **WHEN** el país del pagador es Colombia
- **THEN** se exige documento de identidad, celular de 10 dígitos con +57, departamento, municipio y barrio, y se ofrecen los métodos de pago de Colombia

#### Scenario: Pagador en Estados Unidos
- **WHEN** el país del pagador es Estados Unidos
- **THEN** no se pide documento, el teléfono lleva +1, la dirección pide estado y ZIP con formato `#####` o `#####-####`, y se ofrecen los métodos de pago de EE.UU.

#### Scenario: El pagador cambia de país a mano
- **WHEN** cambia el país del bloque de facturación
- **THEN** cambian solo los campos de ese bloque; el bloque de envío sigue siendo el colombiano

### Requirement: "Usar los mismos datos de facturación" precarga, no oculta

Cuando el pagador está en Colombia, el bloque *Datos de envío* SHALL ofrecer la casilla "Usar los mismos datos de facturación", marcada por omisión. Marcada, SHALL precargar los campos de envío con los de facturación; los campos SHALL seguir visibles y editables. Editar cualquiera SHALL desmarcar la casilla, de modo que la marca "misma dirección" que guarda el pedido sea verdad. Cuando el pagador está en Estados Unidos, la casilla NO SHALL aparecer.

#### Scenario: Misma dirección
- **WHEN** el pagador está en Colombia y deja la casilla marcada
- **THEN** ve sus datos copiados en el bloque de envío sin escribir nada más, y el pedido queda marcado como "misma dirección"

#### Scenario: Envío a otra persona en Colombia
- **WHEN** el pagador cambia el nombre de quien recibe o cualquier campo de envío
- **THEN** la casilla se desmarca sola y el pedido lleva al destinatario tal como quedó escrito

#### Scenario: Pagador en Estados Unidos
- **WHEN** el país del pagador es Estados Unidos
- **THEN** no hay casilla y el bloque de envío se pide vacío desde el principio

#### Scenario: El envío siempre viaja tal como se ve
- **WHEN** se crea el pedido
- **THEN** los datos de envío guardados son exactamente los que estaban en pantalla, y la casilla solo aporta la marca "misma dirección"

### Requirement: El correo del pedido es el de quien paga

El correo de contacto del pedido —al que llegan "recibido", "confirmado", "enviado", "entregado", el comprobante y la invitación a crear cuenta— SHALL ser el de los *Datos de facturación*. El bloque de envío NO SHALL pedir correo: un regalo no se anuncia al destinatario.

#### Scenario: Compra sorpresa para un familiar
- **WHEN** alguien compra con su correo y envía a otra persona
- **THEN** ningún correo del pedido va al destinatario; todos van a quien pagó

#### Scenario: Cuenta del comprador
- **WHEN** quien pagó crea su cuenta con el correo de la compra
- **THEN** el pedido aparece en su historial, aunque la entrega fuera a otra persona

### Requirement: El destinatario tiene su propio contacto

El bloque de envío SHALL pedir nombre completo y celular colombiano del destinatario (10 dígitos, +57), porque la transportadora se comunica con quien recibe. El documento del destinatario SHALL ser opcional.

#### Scenario: Destinatario sin documento
- **WHEN** el pagador está en EE.UU. y no escribe el documento del familiar
- **THEN** el pedido se crea igual y el operador ve el destinatario sin documento

#### Scenario: Celular del destinatario inválido
- **WHEN** el celular del destinatario no tiene 10 dígitos
- **THEN** el pedido no se crea y el error señala ese campo

### Requirement: Quien recibe el pedido sabe a quién se le envía

El mensaje de WhatsApp al operador, el panel de pedidos, la cuenta del comprador y el correo de "enviado" SHALL mostrar quién paga y a quién se envía. Cuando son la misma persona y dirección, SHALL decirlo una vez en lugar de repetir los datos.

#### Scenario: Mensaje de WhatsApp de un pedido para un familiar
- **WHEN** el pedido tiene pagador en EE.UU. y destinatario en Colombia
- **THEN** el mensaje nombra al pagador con su contacto y, aparte, al destinatario con su celular y su dirección de entrega

#### Scenario: Panel con la misma dirección
- **WHEN** el operador abre un pedido marcado como "misma dirección"
- **THEN** ve un solo bloque de datos y la indicación de que la entrega es a la misma dirección

#### Scenario: Correo de "enviado" a quien pagó por otra persona
- **WHEN** se marca como enviado un pedido cuyo destinatario no es el pagador
- **THEN** el correo al pagador nombra al destinatario y la ciudad de entrega

### Requirement: Con sesión, nada se escribe dos veces

Para un comprador con sesión, el checkout SHALL precargar el bloque de facturación con los datos de su cuenta y su última facturación, y SHALL ofrecer su libreta solo para el bloque de envío.

#### Scenario: Segunda compra desde Estados Unidos
- **WHEN** un comprador con sesión que ya compró desde EE.UU. vuelve al checkout
- **THEN** el bloque de facturación viene lleno con su dirección de EE.UU. del último pedido y puede corregirla

#### Scenario: Libreta en el envío
- **WHEN** el comprador con sesión tiene direcciones guardadas
- **THEN** se ofrecen en el bloque de envío, no en el de facturación

### Requirement: Los pedidos anteriores siguen teniendo sentido

Todo pedido creado antes de este cambio SHALL leerse como "facturación igual al envío": su única dirección era la del propio comprador.

#### Scenario: Pedido antiguo en el panel
- **WHEN** el operador abre un pedido creado antes del cambio
- **THEN** ve la facturación y el envío con los mismos datos y la marca de "misma dirección", sin campos vacíos ni errores
