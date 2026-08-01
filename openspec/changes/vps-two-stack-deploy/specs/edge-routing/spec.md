## Purpose

Define cómo entra el tráfico HTTP al servidor: qué dominio llega a qué entorno, cómo se obtiene y renueva el cifrado, y bajo qué condiciones el entorno de pruebas queda cerrado al público y a los buscadores.

## ADDED Requirements

### Requirement: Cifrado automático y obligatorio

Todo dominio servido SHALL responder por HTTPS con un certificado válido, obtenido y renovado sin intervención manual. Las peticiones que lleguen por HTTP SHALL ser redirigidas a HTTPS de forma permanente.

**Invariante:** la renovación ocurre sin que nadie la recuerde. Un certificado vencido es una caída total del sitio y no puede depender de una tarea humana.

#### Scenario: Petición por HTTP

- **WHEN** un visitante solicita `http://test.korashopp.com`
- **THEN** recibe una redirección permanente a la misma dirección por HTTPS

#### Scenario: Certificado válido

- **WHEN** se inspecciona la cadena de certificación de cualquier dominio servido
- **THEN** el certificado es válido, corresponde al dominio solicitado y no está por vencer dentro de los siguientes 30 días

#### Scenario: Dominio no configurado

- **WHEN** llega una petición cuyo encabezado de host no corresponde a ningún dominio declarado
- **THEN** el borde la rechaza sin exponer ninguno de los entornos

### Requirement: Enrutamiento por nombre de dominio

El borde SHALL dirigir cada petición al entorno que corresponde a su dominio: `test.korashopp.com` al entorno de pruebas y `korashopp.com` junto con `www.korashopp.com` al entorno de producción.

**Invariante:** ningún dominio puede alcanzar dos entornos, y el entorno de pruebas nunca es servido bajo el dominio comercial.

#### Scenario: Dominio de pruebas

- **WHEN** un visitante solicita `test.korashopp.com`
- **THEN** la respuesta proviene del entorno de pruebas

#### Scenario: Dominio comercial con prefijo www

- **WHEN** un visitante solicita `www.korashopp.com`
- **THEN** es dirigido al mismo destino que `korashopp.com`, sin contenido duplicado bajo dos direcciones

### Requirement: El entorno de pruebas está cerrado al público

`test.korashopp.com` SHALL exigir autenticación antes de entregar cualquier contenido, y SHALL declarar en cada respuesta que no debe ser indexado por buscadores.

**Invariante:** el entorno de pruebas contiene datos de demostración y funcionalidad a medio construir. Que aparezca en un buscador o que un cliente lo confunda con la tienda real es un daño de marca, no un detalle técnico.

#### Scenario: Visitante sin credenciales

- **WHEN** un visitante solicita cualquier dirección bajo `test.korashopp.com` sin credenciales
- **THEN** recibe una solicitud de autenticación y ningún contenido de la aplicación

#### Scenario: Buscador rastreando

- **WHEN** se inspeccionan los encabezados de una respuesta autenticada del entorno de pruebas
- **THEN** incluye una directiva que instruye a los buscadores a no indexar ni seguir enlaces

#### Scenario: Producción no exige credenciales

- **WHEN** un visitante solicita el dominio comercial
- **THEN** recibe el contenido sin solicitud de autenticación, y la respuesta no lleva la directiva de no indexación

### Requirement: El borde sobrevive a la caída de un entorno

El borde SHALL operar de forma independiente de los entornos que enruta. La caída de uno NO SHALL impedir que el otro siga siendo servido.

**Invariante:** un despliegue fallido en pruebas no puede sacar del aire el dominio comercial.

#### Scenario: El entorno de pruebas está detenido

- **WHEN** el entorno de pruebas está caído o reiniciándose y llega una petición al dominio comercial
- **THEN** la petición se sirve con normalidad

#### Scenario: Un entorno no responde

- **WHEN** llega una petición a un dominio cuyo entorno está caído
- **THEN** el visitante recibe un error de servicio del borde, no un tiempo de espera agotado ni una conexión rechazada
