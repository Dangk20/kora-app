## Purpose

Reunir en un único centro legal, en su propio subdominio y en español e inglés, todos los documentos que rigen la compra en KORA, con la información que exigen la ley colombiana y las normas de las redes de tarjetas para el pago alojado.

## ADDED Requirements

### Requirement: Centro legal en su propio subdominio
El sistema SHALL servir el centro legal en el host configurado como dirección legal (`legal.korashopp.com` en producción). Las direcciones del centro SHALL tener la forma `/<idioma>/<documento>`, con `<idioma>` ∈ {`es`, `en`}. La raíz SHALL redirigir al índice en el idioma del visitante: cookie de idioma de la tienda primero, luego el origen por IP (exterior → inglés), luego español. Un documento o idioma desconocido SHALL responder 404, nunca 200.

#### Scenario: Documento en el subdominio
- **WHEN** un visitante abre `https://legal.korashopp.com/es/terminos`
- **THEN** recibe 200 con los términos y condiciones en español

#### Scenario: Raíz del subdominio
- **WHEN** un visitante desde EE.UU. sin cookie de idioma abre `https://legal.korashopp.com/`
- **THEN** es redirigido a `/en`, el índice de todos los documentos en inglés

#### Scenario: Documento inexistente
- **WHEN** alguien abre `https://legal.korashopp.com/es/no-existe`
- **THEN** recibe 404

#### Scenario: El subdominio solo sirve lo legal
- **WHEN** alguien abre `https://legal.korashopp.com/catalogo` o `/admin`
- **THEN** no ve la tienda ni el panel: recibe 404

#### Scenario: Entorno sin subdominio configurado
- **WHEN** el entorno no tiene dirección legal propia (desarrollo, pruebas)
- **THEN** el centro legal se sirve bajo `/legal/<idioma>/<documento>` en el mismo host y ningún enlace apunta a un subdominio inexistente

### Requirement: Migración desde las rutas antiguas
Con el subdominio configurado, toda petición a `korashopp.com/legal/<slug>` SHALL redirigir con 301 al documento equivalente en el centro legal, en español. Todo enlace a un documento legal emitido por la tienda (footer, menú móvil, checkout, correos, sitemap) SHALL apuntar a la dirección del centro legal, generada desde una sola definición.

#### Scenario: Enlace antiguo guardado
- **WHEN** alguien abre `https://korashopp.com/legal/cambios`
- **THEN** recibe 301 a `https://legal.korashopp.com/es/cambios`

#### Scenario: Enlace del checkout
- **WHEN** el comprador pulsa «política de tratamiento de datos» en el checkout
- **THEN** llega a la política en el centro legal, en el idioma de la tienda

### Requirement: Navegación del centro legal
Cada documento SHALL mostrar:
- una cabecera de marca con el logotipo, un selector de idioma y el enlace «Volver a KORA»;
- la lista de todos los documentos, con el actual marcado;
- el título y la fecha de última modificación;
- un índice «En esta página» que enlaza cada sección por ancla.

Cada sección SHALL poder llevar un resumen destacado. El selector de idioma SHALL llevar al MISMO documento en el otro idioma. En pantallas estrechas el contenido SHALL caber sin desplazamiento lateral.

#### Scenario: Cambiar de idioma dentro de un documento
- **WHEN** el visitante está en `/es/envios` y elige English
- **THEN** llega a `/en/envios`, no al índice

#### Scenario: Índice de secciones
- **WHEN** el visitante pulsa una entrada de «En esta página»
- **THEN** la página se desplaza a esa sección y la URL lleva su ancla

### Requirement: Documentos en dos idiomas sin claves sueltas
Cada documento SHALL existir en español y en inglés, con las mismas secciones en el mismo orden. La versión en inglés SHALL declarar que en Colombia prevalece la versión en español. Las cifras (vigencia del pedido, tasa y vigencia del cashback, plazos de cambio, retracto y daño) SHALL venir de las mismas constantes del sistema en los dos idiomas, nunca escritas a mano.

#### Scenario: Paridad de secciones
- **WHEN** se compara cualquier documento en `es` y en `en`
- **THEN** tienen el mismo número de secciones, y cada una el mismo ancla

#### Scenario: Cifra coherente
- **WHEN** la tasa de Kora Cashback cambia en su constante
- **THEN** los dos idiomas publican la nueva tasa sin editar el texto

### Requirement: Juego completo de documentos
El centro legal SHALL publicar, como mínimo:
- términos y condiciones de venta;
- privacidad y tratamiento de datos;
- cambios, devoluciones y reembolsos;
- envíos y entrega;
- seguridad de pagos;
- promociones, cupones y Kora Cashback;
- información del comercio y contacto.

En conjunto SHALL cubrir cada punto de la lista de las redes de tarjetas:
- restricciones legales y de exportación;
- descripción de lo que se vende;
- política de devoluciones y reembolsos;
- contacto con correo y teléfono;
- dirección física y país del comercio;
- monedas de transacción;
- política de entrega;
- privacidad;
- seguridad en la transmisión de datos de tarjeta;
- condiciones de las promociones.

#### Scenario: Monedas publicadas
- **WHEN** se lee la sección de precios y monedas de los términos, en cualquier idioma
- **THEN** nombra COP y USD y cuál de ellas admite el pago con tarjeta

#### Scenario: Entrega solo en Colombia
- **WHEN** se lee la política de envíos
- **THEN** dice que KORA entrega únicamente en Colombia, que quien paga desde el exterior envía a un destinatario en Colombia, y que no se exportan productos

#### Scenario: Ninguna negación de cobro en línea
- **WHEN** se busca en los términos un texto que niegue el cobro en línea («no cobramos en línea», «no tiene pasarela»)
- **THEN** no aparece: los términos describen el pago con tarjeta en la página del procesador y el pago por otros medios coordinado por WhatsApp

### Requirement: Datos de tarjeta fuera de KORA
La política de seguridad de pagos y la de privacidad SHALL declarar que los datos de tarjeta se capturan en la página alojada del procesador y que KORA no los recibe, no los ve y no los almacena. Ningún formulario de la tienda SHALL pedir número, fecha ni código de seguridad de una tarjeta.

#### Scenario: Declaración en las dos políticas
- **WHEN** se leen la política de seguridad de pagos y la de privacidad
- **THEN** ambas dicen que KORA no recibe ni almacena datos de tarjeta

### Requirement: Identidad de los dos comercios
El centro legal SHALL identificar:
- a KORA SHOPP S.A.S. (razón social, NIT, domicilio en Colombia) como vendedora y responsable del tratamiento de datos;
- a la LLC de EE.UU. (nombre legal, estado y dirección física) como el comercio que procesa los pagos con tarjeta.

Los datos de las dos sociedades SHALL venir del entorno. En producción la aplicación SHALL negarse a arrancar si falta cualquiera de ellos, con un mensaje que nombre la variable. En desarrollo y pruebas SHALL mostrar marcadores visibles entre corchetes.

#### Scenario: Falta un dato de la LLC en producción
- **WHEN** producción arranca sin la dirección física de la LLC
- **THEN** el proceso termina con un error que nombra esa variable, y no sirve ninguna página

#### Scenario: Comercio que cobra la tarjeta
- **WHEN** se lee la información del comercio
- **THEN** aparecen la dirección física y el país de las dos sociedades, y cuál de ellas figura en el cobro con tarjeta

### Requirement: Marcas de tarjeta aceptadas
La tienda SHALL mostrar en su footer, en todas las páginas públicas, los logotipos a todo color de las marcas de tarjeta aceptadas. El centro legal SHALL mostrarlos en la seguridad de pagos y en la información del comercio. El conjunto de marcas SHALL salir de una sola lista configurable: una marca no contratada no se muestra.

#### Scenario: Footer de la tienda
- **WHEN** se abre cualquier página pública de la tienda
- **THEN** el footer muestra los logotipos de las marcas aceptadas, cada uno con su nombre como texto alternativo

### Requirement: Footer de la tienda con la información exigida por las redes de tarjetas
Toda página pública de la tienda SHALL terminar en un footer con:
- **Columnas de enlaces:**
  - *Tienda*: catálogo por línea y seguimiento de pedido.
  - *Ayuda*: WhatsApp, cuenta y cambios.
  - *Legal*: cada documento del centro legal, en el idioma de la tienda.
- **Bloque «Medios de pago»**, organizado en tres grupos:
  - tarjetas de crédito y débito: Visa, Mastercard y American Express;
  - transferencia en Colombia, en COP: Nequi y Bre-B;
  - transferencia desde EE.UU., en USD: Zelle.

  Cada grupo lleva sus logotipos, y el bloque dice que las transferencias se coordinan por WhatsApp. Un medio sin logotipo oficial se muestra con su nombre en texto, nunca con un logotipo imitado.
- **Bloque de contacto**, con el WhatsApp y teléfono de atención y el correo de atención, visibles como texto y no solo como ícono.
- **Redes sociales**, únicamente las que tengan dirección configurada.
- **Franja inferior de identificación del comercio**:
  - razón social, NIT, dirección y país de KORA SHOPP S.A.S.;
  - nombre, estado y dirección de la LLC que procesa los pagos con tarjeta;
  - teléfono y correo de atención;
  - el aviso de derechos.

Los datos de las sociedades SHALL salir de la misma configuración que las páginas legales, nunca escritos en el componente. Los enlaces legales SHALL usar la misma definición de dirección del centro legal. En móvil las columnas SHALL apilarse sin desplazamiento lateral, y el footer SHALL respetar la barra inferior de navegación móvil.

#### Scenario: Identificación del comercio en cualquier página
- **WHEN** se abre la ficha de un producto, el carrito o el checkout
- **THEN** al final de la página aparecen razón social, NIT, dirección y país de KORA SHOPP S.A.S., la dirección de la LLC, un teléfono y un correo de atención

#### Scenario: Datos tomados de la configuración
- **WHEN** cambia `KORA_LEGAL_DOMICILIO` y la aplicación se reinicia
- **THEN** el footer y el centro legal muestran la misma dirección nueva, sin desplegar código

#### Scenario: Medios de pago por país
- **WHEN** se abre cualquier página pública de la tienda
- **THEN** el footer muestra las tarjetas, las transferencias de Colombia (Nequi, Bre-B) y la de EE.UU. (Zelle) en grupos separados con su moneda

#### Scenario: Red social sin dirección
- **WHEN** una red social no tiene dirección configurada
- **THEN** su ícono no aparece en el footer

#### Scenario: Footer en móvil
- **WHEN** se abre la tienda en una pantalla de 390 px
- **THEN** los bloques del footer se apilan, nada desborda el ancho y la barra inferior de navegación no tapa la franja de identificación
