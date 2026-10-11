## Purpose

Medir qué publicidad produce ventas confirmadas, con el consentimiento del comprador, informando a Meta y a Google la compra en el único momento en que existe: cuando el operador confirma el pedido.

## ADDED Requirements

### Requirement: Configuración por plataforma, completa o ausente
El sistema SHALL considerar cada plataforma (Meta, GA4, Google Ads) **apagada** si ninguna de sus variables está definida y **encendida** si lo están todas las obligatorias. Una configuración parcial o un identificador con formato inválido SHALL impedir el arranque, informando junto con las demás guardas. Las variables SHALL leerse en el servidor en tiempo de ejecución.

| Plataforma | Obligatorias | Opcionales |
|---|---|---|
| Meta | `KORA_META_PIXEL_ID` (solo dígitos), `KORA_META_CAPI_TOKEN` | `KORA_META_TEST_EVENT_CODE` |
| GA4 | `KORA_GA4_MEASUREMENT_ID` (`G-…`), `KORA_GA4_API_SECRET` | — |
| Google Ads | `KORA_GOOGLE_ADS_ID` (`AW-…`) — exige GA4 encendido | — |

#### Scenario: Sin variables
- **WHEN** ninguna variable de medición está definida
- **THEN** la tienda no carga etiquetas, no muestra el banner y la aplicación arranca

#### Scenario: Configuración a medias
- **WHEN** está `KORA_META_PIXEL_ID` pero no `KORA_META_CAPI_TOKEN`
- **THEN** la aplicación no arranca y el informe nombra la variable que falta

### Requirement: Consentimiento antes de medir
Con alguna plataforma encendida, la tienda SHALL mostrar un aviso de cookies de medición con *Aceptar* y *Solo necesarias* con el mismo peso visual, hasta que el visitante elija. Ninguna etiqueta de terceros SHALL cargarse antes de *Aceptar*. La elección SHALL guardarse 180 días en la cookie `kora_consentimiento` y SHALL poder cambiarse desde el footer. El aviso SHALL estar en el idioma de la tienda y enlazar la política de privacidad.

#### Scenario: Rechazo
- **WHEN** el visitante elige *Solo necesarias*
- **THEN** no se carga el píxel ni gtag, y un pedido suyo no se informa a ninguna plataforma

#### Scenario: El panel y el centro legal no miden
- **WHEN** alguien navega por `/admin` o por el centro legal
- **THEN** no hay aviso ni etiquetas

### Requirement: Eventos de navegación
Con consentimiento, la tienda SHALL emitir: vista de página en cada navegación (incluidas las del lado del cliente); `ViewContent`/`view_item` al abrir una ficha; `AddToCart`/`add_to_cart` al agregar; `InitiateCheckout`/`begin_checkout` al abrir el checkout con productos; `Lead`/`generate_lead` al crear el pedido. Valor y moneda SHALL ser los que ve el comprador. La compra (`Purchase`) NO SHALL emitirse desde el navegador.

#### Scenario: Pedido creado
- **WHEN** el comprador crea un pedido de USD 40
- **THEN** se emite `Lead` con `value: 40`, `currency: "USD"` y ningún `Purchase`

### Requirement: Origen del pedido
La tienda SHALL registrar en la cookie `kora_origen` (30 días) la última visita con origen identificable: parámetros `utm_*`, `fbclid`, `gclid` y la página de entrada. Una visita directa o interna SHALL NO reemplazar un origen existente. Al crear un pedido, el sistema SHALL guardar en `order_attributions`, en la misma transacción: el origen (si hay), si hubo consentimiento y, solo con consentimiento, `_fbp`, `_fbc` (o uno derivado de `fbclid`), el cliente y la sesión de GA4, el navegador y la IP de confianza. El panel SHALL mostrar el origen en el detalle del pedido.

#### Scenario: Llegada desde un anuncio
- **WHEN** alguien entra con `?utm_source=meta&utm_campaign=apertura-neiva`, navega directo otro día y compra
- **THEN** el pedido queda con `source = meta` y `campaign = apertura-neiva`

#### Scenario: Sin consentimiento
- **WHEN** el comprador no aceptó la medición
- **THEN** el pedido guarda origen y `consent = false`, y ningún identificador de plataforma, navegador ni IP

### Requirement: Compra informada al confirmar
Al procesar `order.confirmed` de un pedido `WEB` con consentimiento, el worker SHALL enviar:
- a Meta (API de Conversiones) un `Purchase` con `event_id = "order-<id>"`, `event_time` = confirmación, `value` = total del pedido, su moneda, los productos, y los datos del comprador normalizados y cifrados con SHA-256 (correo, teléfono, nombre, ciudad, departamento, país, identificador externo);
- a GA4 (Measurement Protocol) un `purchase` con `transaction_id` = código del pedido, valor, moneda y productos, con el cliente y la sesión guardados.

El envío SHALL ser idempotente por pedido y plataforma: un pedido ya informado no se vuelve a enviar. Un fallo del proveedor SHALL reintentarse con la política del worker. Una plataforma apagada, un pedido POS o sin consentimiento SHALL NO enviarse ni fallar.

#### Scenario: Reintento
- **WHEN** el evento `order.confirmed` se procesa dos veces
- **THEN** Meta y GA4 reciben la compra una sola vez

#### Scenario: Pedido del POS
- **WHEN** se confirma una venta de mostrador
- **THEN** no se informa a ninguna plataforma

### Requirement: Política de privacidad coherente
Con alguna plataforma encendida, la sección *Cookies* de la política de privacidad (es y en) SHALL decir que, con autorización del titular, se usan cookies de medición de Meta y Google, para qué, cómo se retira la autorización, y que los datos enviados van cifrados. Apagada, SHALL conservar el texto vigente.

#### Scenario: Medición apagada
- **WHEN** no hay ninguna plataforma configurada
- **THEN** la sección *Cookies* dice que solo se usan cookies necesarias, como en el texto aprobado el 23 sep 2026

#### Scenario: Medición encendida
- **WHEN** Meta o GA4 están configurados
- **THEN** la sección *Cookies* nombra a Meta y Google, sus finalidades, el cifrado SHA-256 y cómo retirar la autorización
