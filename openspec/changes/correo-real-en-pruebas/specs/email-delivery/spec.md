## ADDED Requirements

### Requirement: Fuera de producción, el proveedor solo entrega a destinatarios permitidos

En un entorno que no es producción, si el proveedor está configurado, el sistema SHALL exigir una lista explícita de destinatarios permitidos. Un correo a una dirección de la lista SHALL salir por el proveedor; un correo a cualquier otra dirección SHALL escribirse a disco, y el envío SHALL reportarse como correcto en ambos casos.

**Invariante:** la base de pruebas tiene direcciones de personas reales, porque quien prueba un pedido escribe la suya. Sin esta lista no hay término medio entre "nada sale" y "todo sale", y el segundo estado es una fuga esperando una campaña de demostración.

#### Scenario: Destinatario en la lista

- **WHEN** en pruebas se envía un correo a una dirección de la lista
- **THEN** sale por el proveedor y se registra su identificador

#### Scenario: Destinatario fuera de la lista

- **WHEN** en pruebas se envía un correo a una dirección que no está en la lista
- **THEN** se escribe a disco y no llega al proveedor

#### Scenario: Comparación sin distinguir mayúsculas

- **WHEN** la lista contiene `Ana@Ejemplo.com` y el destinatario es `ana@ejemplo.com`
- **THEN** cuenta como permitido

### Requirement: La lista y el entorno tienen que ser coherentes al arrancar

Fuera de producción, con proveedor configurado y **sin** lista, la aplicación SHALL negarse a arrancar. En producción, con lista puesta, la aplicación SHALL negarse a arrancar. En ambos casos SHALL decir qué variable sobra o falta.

**Invariante:** una lista olvidada en producción dejaría a los compradores sin sus correos sin producir ningún error — la configuración ambigua se rechaza, nunca se interpreta.

#### Scenario: Pruebas con proveedor y sin lista

- **WHEN** arranca un entorno que no es producción con el proveedor configurado y sin lista
- **THEN** no arranca, e indica que falta `KORA_EMAIL_ALLOWLIST`

#### Scenario: Producción con lista

- **WHEN** arranca producción con `KORA_EMAIL_ALLOWLIST` definida
- **THEN** no arranca, e indica que esa variable no puede existir en producción

#### Scenario: Pruebas sin proveedor

- **WHEN** arranca un entorno que no es producción sin proveedor configurado
- **THEN** arranca y todos los correos van a disco, como hasta ahora
