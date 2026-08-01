## Purpose

Sustituye la página de parking genérica del proveedor por una presencia de marca en el dominio comercial mientras la tienda no está publicada, respetando la voz definida en el brand book y sin prometer nada que el negocio todavía no pueda cumplir.

## ADDED Requirements

### Requirement: Contenido de la página de espera

La página SHALL presentar, en español, el logotipo de KORA y el siguiente contenido aprobado: el titular **"Esto apenas comienza."**, la bajada **"Todo lo que buscas, en un solo lugar."**, el cuerpo **"Estamos preparando cada detalle para abrir nuestra tienda en línea."**, el cierre **"Pequeños detalles, grandes recuerdos."** y el pie **"Colombia · Estados Unidos"**.

#### Scenario: Visitante llega al dominio comercial

- **WHEN** un visitante solicita `korashopp.com`
- **THEN** recibe la página de espera con el logotipo y los cinco textos aprobados, y ninguna referencia al proveedor de alojamiento

#### Scenario: La página declara su propósito a los buscadores

- **WHEN** un buscador rastrea el dominio comercial
- **THEN** encuentra un título y una descripción que identifican a KORA, sin bloquear la indexación

### Requirement: La voz respeta el brand book

El texto de la página NO SHALL contener lenguaje de presión, urgencia o exageración. Quedan prohibidas las palabras y expresiones que el brand book lista como evitadas: *urgente*, *última oportunidad*, *compra ya*, *aprovecha antes de que se acabe*, *oferta imperdible*, *exclusivo* cuando no sea cierto, *liquidación*, *barato*, *lujo* e *imposible*.

**Invariante:** la marca declara por escrito que "nunca presiona, nunca exagera y nunca promete lo que no puede cumplir". Una cuenta regresiva, una lista de espera con escasez fingida o una promesa de fecha son violaciones de esa regla, no decisiones de diseño.

#### Scenario: Revisión del texto publicado

- **WHEN** se revisa el texto completo de la página contra la lista de palabras evitadas
- **THEN** no aparece ninguna de ellas, en ninguna forma ni conjugación

#### Scenario: No se promete una fecha

- **WHEN** se revisa el contenido en busca de compromisos de apertura
- **THEN** no hay fecha, cuenta regresiva ni plazo declarado

### Requirement: Sin captura de datos ni canal de contacto

La página NO SHALL incluir formularios, campos de correo electrónico ni ningún mecanismo de captura de datos personales. NO SHALL publicar un número de teléfono o enlace de mensajería.

**Invariante:** el número de WhatsApp comercial sigue sin confirmar por el cliente y capturar correos exige consentimiento, almacenamiento y una política de tratamiento de datos que aún no existen. Publicar un canal equivocado cuesta más que no publicar ninguno.

#### Scenario: Búsqueda de formularios

- **WHEN** se inspecciona el documento entregado
- **THEN** no contiene campos de entrada, formularios ni destinos de envío de datos

#### Scenario: Búsqueda de canales de contacto

- **WHEN** se inspecciona el documento en busca de números telefónicos o enlaces de mensajería
- **THEN** no encuentra ninguno

### Requirement: La página es autónoma y no depende de la aplicación

La página SHALL servirse como contenido estático desde el borde, sin requerir que la aplicación, la base de datos o la caché estén disponibles. Todos sus recursos SHALL estar contenidos en el propio servidor, sin peticiones a terceros.

**Invariante:** su única razón de existir es cubrir el periodo en que la aplicación no está publicada. Una página de espera que se cae cuando la aplicación se cae no cumple su función.

#### Scenario: La aplicación está detenida

- **WHEN** los contenedores de la aplicación de producción están detenidos y llega una petición al dominio comercial
- **THEN** la página de espera se sirve completa y con estilo, sin errores

#### Scenario: Sin dependencias externas

- **WHEN** se cargan la página y todos sus recursos con el registro de red activo
- **THEN** ninguna petición sale hacia un dominio de terceros

### Requirement: Identidad visual conforme a los tokens vigentes

La página SHALL usar exclusivamente el color y la tipografía definidos como tokens de marca del proyecto. NO SHALL introducir colores fuera de la paleta oficial.

#### Scenario: Revisión de color

- **WHEN** se auditan los colores declarados en la página
- **THEN** todos corresponden a tokens de marca vigentes y ninguno es un valor inventado para esta página

#### Scenario: Lectura en pantalla pequeña

- **WHEN** la página se abre en un ancho de pantalla de teléfono
- **THEN** el contenido se lee completo sin desplazamiento horizontal y sin texto recortado
