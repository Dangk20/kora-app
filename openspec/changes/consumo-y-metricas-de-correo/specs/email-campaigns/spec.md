## MODIFIED Requirements

### Requirement: La campaña reporta lo que sabe y no inventa lo que no

El detalle de una campaña SHALL mostrar **enviados**, **fallidos** y **desuscripciones generadas**.

Las métricas que dependen del proveedor —entregas confirmadas, aperturas, clics y rebotes— SHALL calcularse a partir de los eventos recibidos por webhook, cruzados con los destinatarios de la campaña. Mientras el webhook no esté configurado, SHALL mostrarse como **no disponibles**, con ese motivo.

**Invariante:** un cero es indistinguible de "nadie abrió el correo", y esa lectura hace tomar decisiones comerciales equivocadas sobre datos que no existen. Decir "todavía no medimos esto, y por qué" es información; un cero es ruido. Con el webhook configurado, un cero real —ningún evento de apertura— SÍ es un dato, y se muestra.

#### Scenario: Sin webhook configurado

- **WHEN** se ve el detalle de una campaña enviada sin el webhook del proveedor configurado
- **THEN** enviados y fallidos muestran su número real, y aperturas y clics dicen que no están disponibles porque falta configurar el webhook

#### Scenario: Con webhook y eventos

- **WHEN** el webhook está configurado y han llegado eventos de los mensajes de la campaña
- **THEN** entregas, aperturas, clics y rebotes muestran cuántos destinatarios distintos registran cada uno

#### Scenario: Con webhook y sin eventos todavía

- **WHEN** el webhook está configurado y la campaña acaba de enviarse
- **THEN** las métricas muestran cero, marcadas como "por ahora"
