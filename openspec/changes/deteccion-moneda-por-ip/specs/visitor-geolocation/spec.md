## Purpose

Decidir de qué origen entra un visitante de la tienda pública —Colombia, exterior o desconocido— y con qué grado de confianza, para que la moneda de presentación se elija sola en la primera visita (TIE_HU001 §1). Es la única definición de esa pregunta en el sistema: quien necesite saber de dónde entra alguien pregunta aquí, y nadie más lee cabeceras de geolocalización.

## ADDED Requirements

### Requirement: Origen del visitante con tres respuestas posibles

El sistema SHALL responder exactamente una de tres cosas para cada petición: `colombia`, `exterior` o `desconocido`. `desconocido` es una respuesta legítima y distinta de `exterior`: significa "no lo sé", y nunca se disfraza de país.

#### Scenario: Origen conocido dentro de Colombia
- **WHEN** la fuente de mayor precedencia disponible identifica el origen como Colombia
- **THEN** el origen es `colombia`
- **AND** la moneda activa de un visitante sin elección manual previa es COP

#### Scenario: Origen conocido fuera de Colombia
- **WHEN** la fuente de mayor precedencia disponible identifica un país distinto de Colombia
- **THEN** el origen es `exterior`
- **AND** la moneda activa de un visitante sin elección manual previa es USD

#### Scenario: No hay ninguna fuente utilizable
- **WHEN** no llega cabecera de país y la IP del visitante no puede determinarse o no está en la tabla
- **THEN** el origen es `desconocido`
- **AND** la moneda activa es COP, sin error visible ni entrada de fallo (TIE_HU001, criterios no funcionales)

### Requirement: Precedencia de fuentes, de la más fiable a la menos

El sistema SHALL consultar las fuentes en orden fijo y quedarse con la primera que dé una respuesta utilizable: (1) cabecera de país puesta por un CDN o proxy de confianza, (2) tabla local IP → país sobre la IP del visitante, (3) desconocido. Una fuente que responde "no sé" NO SHALL detener la cadena: cede el turno a la siguiente.

#### Scenario: Cabecera de CDN presente
- **WHEN** llega `cf-ipcountry`, `x-vercel-ip-country` o `x-geo-country` con un código de país válido de dos letras
- **THEN** ese código decide el origen
- **AND** la tabla local NO se consulta

#### Scenario: Cabecera de CDN presente pero sin país real
- **WHEN** la cabecera trae un valor que no identifica un país —`XX` (desconocido para Cloudflare), `T1` (red Tor), vacío, o cualquier cosa que no sean dos letras
- **THEN** la cabecera se descarta
- **AND** la resolución continúa con la tabla local sobre la IP

#### Scenario: Sin cabeceras, con IP resoluble
- **WHEN** no hay cabecera de país utilizable y la IP del visitante cae dentro de un rango conocido de la tabla
- **THEN** el origen sale de la tabla

### Requirement: La IP del visitante no puede ser dictada por el visitante

El sistema SHALL tomar la IP de origen de forma que un cliente no pueda fijarla enviando cabeceras. Sobre `X-Forwarded-For`, el valor de confianza es el que añade el proxy propio —el situado más a la derecha—, nunca el primero de la lista, que es texto que el cliente eligió.

#### Scenario: Un cliente intenta fijar su país
- **WHEN** llega una petición con `X-Forwarded-For: 8.8.8.8` escrita por el cliente y el borde propio añade la IP real del par TCP
- **THEN** se usa la IP añadida por el borde
- **AND** la IP inventada por el cliente se ignora

#### Scenario: Petición directa sin proxy (desarrollo local)
- **WHEN** no hay ninguna cabecera de reenvío
- **THEN** la IP es `desconocida` y el origen también
- **AND** la tienda se sirve en COP

### Requirement: Direcciones que no identifican un origen geográfico

El sistema SHALL tratar como `desconocido` toda dirección que no corresponde a un visitante en internet: bucle local, redes privadas, enlace local, CGNAT, direcciones IPv6 de uso local, y direcciones sintácticamente inválidas.

#### Scenario: Comprobación de salud o petición interna
- **WHEN** la IP resuelta es `127.0.0.1`, una de `10/8`, `172.16/12`, `192.168/16`, `100.64/10`, `169.254/16`, `::1` o `fc00::/7`
- **THEN** el origen es `desconocido`
- **AND** no se consulta la tabla

#### Scenario: Cadena de reenvío corrupta
- **WHEN** el valor de la cabecera no es una dirección IP válida
- **THEN** el origen es `desconocido`, sin excepción propagada a la petición

### Requirement: Tabla IP → país versionada, sin llamadas externas en tiempo de petición

El sistema NO SHALL consultar ningún servicio externo para resolver el origen de una petición. La tabla vive en el repositorio, se carga una vez por proceso y lleva escrita dentro la fecha de la instantánea de la que salió.

#### Scenario: Resolución sin red
- **WHEN** el servidor no tiene salida a internet
- **THEN** la detección por IP sigue funcionando igual

#### Scenario: Cobertura declarada de la tabla
- **WHEN** la IP del visitante es IPv4
- **THEN** la tabla distingue `colombia`, `exterior` y `desconocido`
- **WHEN** la IP del visitante es IPv6
- **THEN** la tabla solo puede confirmar `colombia`; cualquier otra IPv6 es `desconocido` y se sirve en COP

#### Scenario: Regeneración de la tabla
- **WHEN** se ejecuta el comando de actualización
- **THEN** la tabla se regenera desde la fuente de dominio público y queda como un cambio revisable en el repositorio
- **AND** ni el build ni el arranque de la aplicación descargan nada

### Requirement: La elección manual del visitante prevalece siempre

El sistema NO SHALL sobrescribir nunca una elección manual de moneda con el resultado de la detección (TIE_HU001 §1 y §2). La detección solo actúa cuando no hay preferencia guardada.

#### Scenario: Visitante que ya eligió moneda
- **WHEN** existe la cookie de moneda con un valor válido
- **THEN** esa es la moneda activa
- **AND** no se consulta ninguna fuente de geolocalización

#### Scenario: Colombiano que quiere ver dólares
- **WHEN** un visitante detectado como `colombia` elige USD en el selector
- **THEN** la tienda queda en USD en esa visita y en las siguientes

### Requirement: El estado de la detección es comprobable desde fuera del código

El sistema SHALL ofrecer una forma de preguntar, para una dirección IP dada, qué origen y qué moneda decidiría — sin levantar la tienda ni leer el código. Que la detección esté apagada nunca produce un error: sin esto, "no está detectando" solo se descubre por deducción.

#### Scenario: Diagnóstico de una IP concreta
- **WHEN** se ejecuta el comando de comprobación con una dirección IP
- **THEN** informa el origen resuelto, la moneda que implicaría y la fecha de la instantánea de la tabla
