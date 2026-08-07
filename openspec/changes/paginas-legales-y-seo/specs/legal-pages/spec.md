## Purpose

Las páginas legales públicas de la tienda —tratamiento de datos personales, condiciones de venta y política de cambios— junto con los datos del comerciante que las sostienen y la garantía de que ninguna de las tres puede publicarse sin llenar.

## ADDED Requirements

### Requirement: Las tres páginas legales son públicas y accesibles sin sesión

El sistema SHALL servir tres páginas legales bajo `/legal/`: tratamiento de datos personales, condiciones de venta, y política de cambios. Las tres SHALL responder a cualquier visitante sin exigir sesión, cuenta ni consentimiento previo.

#### Scenario: Visitante anónimo abre una página legal

- **WHEN** un visitante sin sesión de comprador ni de operador abre `/legal/datos-personales`, `/legal/terminos` o `/legal/cambios`
- **THEN** el sistema responde 200 con el contenido completo de la política, dentro del layout de la tienda (cabecera, footer y selector de moneda)

#### Scenario: Una ruta legal inexistente

- **WHEN** un visitante abre `/legal/cualquier-otra-cosa`
- **THEN** el sistema responde 404, y no una página legal vacía

### Requirement: La aplicación no arranca en producción con datos del comerciante sin llenar

Los datos del comerciante —razón social, NIT, domicilio y correo de atención al titular— SHALL provenir de configuración de entorno, y SHALL existir una única fuente de verdad sobre cuáles son obligatorios.

En producción, el sistema SHALL verificar esa configuración **al arrancar el proceso** y SHALL terminar con código de salida distinto de cero si falta alguno. La comprobación NO SHALL ser perezosa: un contenedor que arranca y responde el health check con `[RAZÓN SOCIAL]` publicado en su política de datos es peor que un contenedor que no arranca, porque el fallo lo descubre la SIC o el primer comprador en vez del despliegue.

En desarrollo la ausencia de esos datos SHALL ser tolerada, con valores de marcador visibles, para no romper a quien clone el repositorio.

#### Scenario: Producción sin razón social configurada

- **WHEN** el proceso arranca con `NODE_ENV=production` y la razón social vacía o ausente
- **THEN** el proceso escribe en consola qué variables faltan y termina con código distinto de cero, sin llegar a aceptar peticiones

#### Scenario: Producción con la configuración completa

- **WHEN** el proceso arranca con `NODE_ENV=production` y las cuatro variables presentes y no vacías
- **THEN** el proceso arranca con normalidad y las páginas legales muestran los datos reales del comerciante

#### Scenario: Desarrollo sin configurar nada

- **WHEN** un desarrollador clona el repositorio y arranca sin variables del comerciante
- **THEN** la aplicación arranca, las páginas legales se sirven, y los datos ausentes se muestran como marcadores explícitamente identificables como pendientes

### Requirement: El consentimiento del checkout enlaza a la política que autoriza

La casilla de autorización de tratamiento de datos del checkout SHALL enlazar a la política de tratamiento de datos personales. El enlace SHALL abrirse sin abandonar ni vaciar el checkout en curso.

Esta es la razón de ser del change: hoy el sistema pide autorización para un tratamiento que no está descrito en ninguna parte, y un consentimiento que no dice a qué se consiente no acredita nada ante la autoridad.

#### Scenario: El comprador quiere leer qué está autorizando

- **WHEN** el comprador está en el checkout con datos ya escritos en el formulario y abre el enlace a la política desde el texto del consentimiento
- **THEN** la política se abre en una pestaña nueva y el checkout conserva intactos los datos escritos y el carrito

#### Scenario: La casilla sigue siendo obligatoria

- **WHEN** el comprador intenta crear el pedido sin marcar la autorización de tratamiento de datos
- **THEN** el sistema rechaza la creación del pedido y señala el campo, igual que antes de este cambio

### Requirement: Las políticas legales son accesibles desde toda la tienda

El footer de la tienda SHALL enlazar a las tres páginas legales desde cualquier página pública.

#### Scenario: El comprador busca la política de cambios antes de comprar

- **WHEN** el comprador está en la ficha de un producto y baja al footer
- **THEN** encuentra enlaces visibles a las tres políticas

### Requirement: La política de cambios preserva los derechos irrenunciables del comprador

La página de cambios SHALL publicar la política comercial del cliente —cambio de producto dentro de 30 días calendario, con producto nuevo, etiquetas originales y empaque en perfecto estado— y SHALL además informar, de forma separada y sin condicionarlos a esa política, el **derecho de retracto** de 5 días hábiles en ventas a distancia y la **garantía legal** por producto defectuoso.

El sistema NO SHALL publicar una afirmación absoluta de que no se devuelve dinero en ningún caso. La política comercial del cliente es más generosa que el mínimo legal en el plazo de cambio, y convive con esos dos derechos en lugar de sustituirlos.

#### Scenario: El comprador consulta si puede retractarse

- **WHEN** un comprador abre `/legal/cambios`
- **THEN** encuentra, en secciones distinguibles, la política de cambios de 30 días del comerciante y, por separado, el derecho de retracto de 5 días hábiles con su procedimiento y el canal para ejercerlo

#### Scenario: Fijado contra una regresión de contenido

- **WHEN** se ejecuta la verificación automática del contenido legal
- **THEN** falla si la página de cambios omite la mención al derecho de retracto o a la garantía legal, o si contiene una negación absoluta de devolución de dinero

### Requirement: Las condiciones de venta describen el negocio tal como opera

Las condiciones de venta SHALL describir el funcionamiento real del sistema, no uno genérico. En particular SHALL informar que la plataforma **no procesa pagos**: el pedido se confirma y se cobra por WhatsApp, fuera de la plataforma; que el pedido tiene una vigencia limitada antes de expirar; que la disponibilidad mostrada está sujeta a confirmación; y que cada moneda tiene su propio precio cargado, sin conversión por tasa de cambio.

Las condiciones NO SHALL prometer servicios que el negocio no sostiene hoy —cuotas, compra protegida, envío gratis, devolución de dinero por insatisfacción—, en coherencia con la decisión ya tomada para la tienda pública.

#### Scenario: El comprador quiere saber cómo se paga

- **WHEN** un comprador abre `/legal/terminos`
- **THEN** encuentra explicado que el pago se coordina por WhatsApp con el operador y que la plataforma no captura datos de tarjeta ni procesa cobros

#### Scenario: Coherencia con la vigencia real del pedido

- **WHEN** las condiciones informan el plazo de vigencia del pedido pendiente
- **THEN** ese plazo coincide con el que el sistema aplica realmente al expirar pedidos, y no es un número escrito a mano en el texto
