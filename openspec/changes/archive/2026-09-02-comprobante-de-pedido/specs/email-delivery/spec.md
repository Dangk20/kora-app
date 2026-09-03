## MODIFIED Requirements

### Requirement: El envío pasa por una sola interfaz con dos implementaciones

Todo correo SHALL salir por la misma interfaz. En desarrollo SHALL usarse un driver que **escribe el correo a disco** en vez de enviarlo; en producción, el del proveedor.

Un correo PUEDE llevar archivos adjuntos. Cuando los lleva, **ambos drivers SHALL entregarlos**: el de producción los envía con el mensaje, y el de desarrollo los **escribe a disco junto al correo**, con su nombre real y abribles.

**Invariante:** es la misma forma que resolvió el almacenamiento de imágenes, y por el mismo motivo. Sin un driver de desarrollo no hay manera de trabajar en el módulo —ni de probarlo— sin una cuenta de proveedor y un dominio verificado, que hoy no existen. Y escribir el correo a disco, en vez de solo registrar que se envió, permite **abrirlo y leerlo**: un correo roto se ve, no se deduce. Un adjunto que solo se cuenta en un registro no se puede revisar; escribirlo también permite abrir el PDF y comprobar que dice lo que debe decir antes de que lo reciba nadie.

#### Scenario: Desarrollo sin proveedor

- **WHEN** se envía un correo en desarrollo
- **THEN** queda un archivo legible con su destinatario, asunto y contenido, y el envío se reporta como correcto

#### Scenario: Producción con proveedor

- **WHEN** se envía un correo en producción con el proveedor configurado
- **THEN** se entrega por el proveedor y se registra su identificador de mensaje

#### Scenario: El proveedor falla

- **WHEN** el proveedor rechaza o no responde
- **THEN** el envío se reporta como fallido con su motivo, y no se marca al destinatario como enviado

#### Scenario: Un correo con adjunto en desarrollo

- **WHEN** se envía en desarrollo un correo que lleva un adjunto
- **THEN** el adjunto queda escrito a disco junto al correo, con su nombre de archivo, y se puede abrir

#### Scenario: Un correo con adjunto en producción

- **WHEN** se envía en producción un correo que lleva un adjunto
- **THEN** el proveedor lo entrega junto al mensaje
