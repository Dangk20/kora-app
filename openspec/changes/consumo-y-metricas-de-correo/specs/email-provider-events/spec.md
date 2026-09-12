## Purpose

Cómo entran a KORA los eventos que el proveedor de correo reporta sobre cada
mensaje (entregado, abierto, clic, rebote, queja), cómo se comprueba que son
suyos, y qué efectos tienen.

## ADDED Requirements

### Requirement: Solo se aceptan eventos firmados por el proveedor

El endpoint de webhooks SHALL verificar la firma de cada petición con el secreto configurado y SHALL rechazar las que no la superen o cuya marca de tiempo tenga más de cinco minutos. Sin secreto configurado, el endpoint SHALL responder que no está configurado y no procesar nada.

**Invariante:** un evento de rebote falso da de baja una dirección; uno de queja falso da de baja a un cliente. El endpoint es público por necesidad, así que la firma es lo único que separa al proveedor de cualquiera.

#### Scenario: Firma válida

- **WHEN** llega una petición firmada con el secreto y reciente
- **THEN** se procesa y responde 200

#### Scenario: Firma inválida

- **WHEN** llega una petición con firma incorrecta o sin ella
- **THEN** se rechaza con 401 y no se guarda nada

#### Scenario: Petición vieja

- **WHEN** la marca de tiempo tiene más de cinco minutos
- **THEN** se rechaza

#### Scenario: Sin secreto

- **WHEN** no hay secreto configurado
- **THEN** responde 503 y no procesa

### Requirement: Un evento se guarda una sola vez

Cada evento SHALL guardarse con su identificador de entrega del proveedor; una entrega repetida del mismo evento NO SHALL duplicarlo, y SHALL responder 200 igualmente.

**Invariante:** el proveedor reintenta hasta recibir 200. Responder error a un duplicado haría que reintentara para siempre; guardarlo dos veces contaría dos aperturas de una.

#### Scenario: Reintento del proveedor

- **WHEN** llega dos veces el mismo evento
- **THEN** existe un solo registro y ambas respuestas son 200

### Requirement: Rebotes y quejas alimentan la supresión

Un rebote duro SHALL marcar la dirección como no utilizable; una queja de spam SHALL dar de baja al cliente. Ambos por las funciones de supresión que ya existen, no por escritura directa.

#### Scenario: Rebote duro

- **WHEN** el proveedor reporta rebote de una dirección
- **THEN** ningún correo más sale a esa dirección hasta que se corrija

#### Scenario: Queja

- **WHEN** el proveedor reporta queja de spam
- **THEN** el cliente queda dado de baja del marketing

### Requirement: Un evento de un mensaje desconocido no rompe nada

Un evento cuyo identificador no corresponde a ningún envío registrado SHALL guardarse igualmente y responder 200.

#### Scenario: Mensaje no reconocido

- **WHEN** llega un evento de un identificador que KORA no conoce
- **THEN** se guarda y responde 200
