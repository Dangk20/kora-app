## 1. Configuración

- [x] 1.1 `measurement/config.ts`: lectura por plataforma, validación de formato, `assertMeasurementConfigured`, `measurementPublicConfig()`
- [x] 1.2 Guarda en `startup-guards.ts`; variables en `.env.example`

## 2. Datos

- [x] 2.1 Migración: `order_attributions` (1:1 con `orders`) y `ad_conversions` (único `orderId + platform`)
- [x] 2.2 `measurement/attribution.ts`: lectura de parámetros, regla de último toque no directo, formato de la cookie (puro)
- [x] 2.3 `measurement/request.ts`: lectura de cookies y cabeceras al crear el pedido; `_fbc` derivado de `fbclid`; cliente y sesión de GA4
- [x] 2.4 `createOrder()` escribe la atribución en su transacción

## 3. Navegador

- [x] 3.1 `MeasurementTags`: banner de consentimiento, carga de píxel y gtag tras aceptar, vista de página por navegación, captura de origen
- [x] 3.2 `track.ts`: `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead` y sus equivalentes GA4
- [x] 3.3 Enganches en ficha, checkout y puente de WhatsApp; enlace "Preferencias de cookies" en el footer

## 4. Servidor

- [x] 4.1 `measurement/hash.ts`: normalización y SHA-256
- [x] 4.2 `measurement/purchase.ts`: cargas útiles puras de Meta y GA4 + envío
- [x] 4.3 Manejadores `order-confirmed-meta-capi` y `order-confirmed-ga4`, idempotentes por `ad_conversions`
- [x] 4.4 `pnpm medicion:probar`

## 5. Panel y legal

- [x] 5.1 Origen del pedido en el detalle del panel
- [x] 5.2 Sección *Cookies* condicionada a `contexto.medicion` (es/en)

## 6. Verificación

- [x] 6.1 Pruebas: configuración, atribución, normalización, cargas útiles, manejadores idempotentes, política
- [x] 6.2 `pnpm typecheck && pnpm lint`
- [x] 6.3 Recorrido en el navegador (11 oct, GA4 real `G-98SQXPFP1T`, Meta apagado): banner, rechazo sin scripts, aceptación con `page_view`/`view_item`/`add_to_cart`/`begin_checkout`/`generate_lead`, pedido KO-2026-09668 con origen en el panel, confirmación → `purchase` a GA4
