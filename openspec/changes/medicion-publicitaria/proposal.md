## Why

**Semana del plan:** ninguna. Es **alcance NUEVO, fuera de la cotización** y sin HU. Lo dispara el contrato de consultoría de marketing que KORA firmó con Grexya (16 oct 2026 → 16 ene 2027): la pauta en Meta y Google Ads arranca el 16 oct y la tienda **no mide nada**. No hay píxel de Meta, ni Google Analytics, ni registro de la campaña de origen de un pedido (verificado en el código el 11 oct 2026).

En KORA el problema es más serio que en una tienda corriente: **la venta se cierra por WhatsApp**. El navegador del comprador nunca ve la compra; la venta existe cuando el operador confirma el pedido en el panel, horas después y desde otro equipo. Un píxel puesto "en la página de gracias" no mediría ninguna venta. Solo el servidor sabe cuándo ocurrió una, y lo sabe en un sitio exacto: el evento `order.confirmed`.

Sin esto Meta y Google optimizan a ciegas, y el informe del periodo de prueba (16 nov) no puede decir qué campaña vendió.

## What Changes

- **Consentimiento de cookies de medición.** Banner propio en la tienda con dos opciones del mismo peso: *Aceptar* y *Solo necesarias*. Sin aceptación **no carga ninguna etiqueta de terceros** y el servidor **no envía** conversiones de ese comprador. La decisión se guarda en una cookie propia y se puede cambiar desde el footer.
- **Etiquetas en la tienda** (solo zona tienda: nunca el panel ni el centro legal), configuradas por entorno:
  - Píxel de Meta: `PageView` en cada navegación, `ViewContent` en la ficha, `AddToCart`, `InitiateCheckout` y `Lead` al crear el pedido.
  - Google (gtag): GA4 con los equivalentes (`view_item`, `add_to_cart`, `begin_checkout`, `generate_lead`) y, si se configura, la etiqueta de Google Ads para remarketing.
- **Origen de cada pedido.** Cookie propia `kora_origen` con la última visita con origen identificable (UTM, `fbclid`, `gclid`, página de entrada). Al crear el pedido se guarda en una tabla nueva `order_attributions`, junto con los identificadores que las plataformas necesitan para emparejar (`_fbp`, `_fbc`, cliente y sesión de GA4, navegador e IP) **solo si hubo consentimiento**. El panel de pedidos muestra el origen.
- **La compra se informa desde el servidor, al confirmar.** Dos manejadores nuevos de `order.confirmed` en el worker:
  - Meta **API de Conversiones**: evento `Purchase` con `event_id` estable por pedido, valor neto y moneda reales, y datos del comprador **normalizados y cifrados con SHA-256**.
  - GA4 **Measurement Protocol**: evento `purchase` con el código del pedido como `transaction_id`. Google Ads importa esa conversión desde GA4.
  - Solo pedidos de la tienda (`WEB`) con consentimiento. Idempotentes por pedido y plataforma (tabla `ad_conversions`).
- **Configuración por entorno con guarda de arranque.** Variables `KORA_META_PIXEL_ID`, `KORA_META_CAPI_TOKEN`, `KORA_META_TEST_EVENT_CODE`, `KORA_GA4_MEASUREMENT_ID`, `KORA_GA4_API_SECRET`, `KORA_GOOGLE_ADS_ID`. Cada plataforma está apagada si no tiene variables, encendida si las tiene todas, y **la aplicación no arranca** con una configuración a medias o con un identificador mal formado. Se leen en el servidor al ejecutarse, nunca `NEXT_PUBLIC_*`: la imagen se compila una vez para pruebas y producción.
- **Política de privacidad.** La sección *Cookies* deja de decir que no hay cookies de terceros **cuando la medición está encendida**, y nombra a Meta y Google como destinatarios con autorización del titular.
- **Prueba de punta a punta:** `pnpm medicion:probar` envía un `Purchase` de prueba a Meta (con el código de eventos de prueba) y un `purchase` al validador de GA4, y dice qué falló.

## Capabilities

### New Capabilities
- `ad-measurement`: consentimiento, etiquetas de la tienda, atribución del pedido y envío de conversiones confirmadas desde el servidor.

### Modified Capabilities
- `legal-center` (change `centro-legal`): la sección de cookies de la política de privacidad depende de si la medición está encendida.

## Impact

- **Esquema:** dos tablas nuevas (`order_attributions`, `ad_conversions`), sin tocar columnas existentes de `orders`.
- **Checkout:** `createOrder()` escribe la atribución dentro de su transacción. No llama a ningún tercero: la regla de "nada sale desde la acción" se mantiene.
- **Worker:** dos manejadores nuevos en `order.confirmed`, registrados después del cashback y los correos.
- **Despliegue:** variables nuevas opcionales en `.env.production`; en pruebas solo con `KORA_META_TEST_EVENT_CODE` para no ensuciar los datos reales.
- **Legal:** cambia el texto aprobado de la política de privacidad → **requiere visto bueno del cliente antes de encender la medición en producción.**
