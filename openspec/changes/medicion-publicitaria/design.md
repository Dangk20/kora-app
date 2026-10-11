## Context

La venta de KORA ocurre fuera del navegador: el comprador crea el pedido, se va a WhatsApp y horas después un operador lo confirma en el panel. Todo lo que dependa de "la página de gracias" mide pedidos creados, no ventas. El sistema ya tiene el punto exacto donde una venta nace —`order.confirmed` en la bandeja de salida— y un worker que reintenta con idempotencia. La medición cuelga de ahí.

## Decisiones

### 1. La compra la cuenta el servidor, el navegador solo cuenta intención

`Purchase` (Meta) y `purchase` (GA4) salen **solo** del worker al confirmar. El navegador emite hasta `Lead` / `generate_lead` (pedido creado). Así no hay que deduplicar compras entre navegador y servidor, y las plataformas reciben ventas reales con el valor que el operador cobró, no carritos que vencieron.

### 2. Consentimiento propio, sin plataforma de terceros

Un banner con dos botones y una cookie (`kora_consentimiento=si|no`, 180 días). Sin aceptación no se inyecta ningún `<script>` de terceros: el banner no es decorativo, es la puerta. Un CMP comercial sería otra dependencia y otra cookie de terceros para un problema de dos estados. El servidor lee la misma cookie al crear el pedido y lo guarda como hecho (`order_attributions.consent`): el worker decide con ese hecho, no con la cookie de hoy.

### 3. Atribución en cookie propia, guardada con el pedido

`kora_origen` guarda JSON con `source, medium, campaign, content, term, fbclid, gclid, landing, at`. Regla de **último toque no directo**: una visita sin parámetros ni referente externo no reemplaza el origen guardado; una con parámetros sí. Si llega `fbclid`/`gclid` sin `utm_source`, se infiere `facebook`/`google` y medio `cpc`. Se escribe desde el cliente (el layout de la tienda es servidor y no puede escribir cookies al renderizar). La cookie es propia y no identifica a nadie: se escribe con o sin consentimiento, igual que la del carrito.

`createOrder()` la lee con `next/headers` y crea `order_attributions` **dentro de su transacción**. Los identificadores de plataforma (`_fbp`, `_fbc`, `_ga`, `_ga_<id>`), el navegador y la IP **solo** se copian con consentimiento. `_fbc` se deriva de `fbclid` si el píxel aún no la escribió (`fb.1.<ms>.<fbclid>`), que es el formato documentado por Meta.

Tabla aparte y no columnas en `orders`: el pedido es el snapshot de la venta; la atribución es un dato de marketing con otra vida (se puede purgar sin tocar ventas).

### 4. Envío idempotente con registro después del éxito

`ad_conversions` con único `(orderId, platform)`. El manejador comprueba la fila, envía y la inserta. Si muere entre enviar y registrar, el reintento envía otra vez — **y no pasa nada**: Meta deduplica por `event_id` (`order-<id>`) y GA4 por `transaction_id`. Por eso aquí, a diferencia del correo, no hace falta reservar antes: el duplicado lo absorbe el proveedor y el peor caso del orden inverso (no informar nunca una venta) es peor.

Un fallo del proveedor **lanza** y el evento se reintenta con la política del worker, igual que los correos. Los manejadores del cashback y los correos son idempotentes, así que reintentar el evento completo no duplica nada.

### 5. Datos personales a Meta: normalizados y cifrados

Correo en minúsculas y sin espacios; teléfono solo dígitos con indicativo; nombre y apellido en minúsculas; ciudad sin espacios ni tildes; país en ISO de dos letras; `external_id` = id del cliente. Todo con SHA-256 antes de salir. IP y navegador van en claro (Meta no los admite cifrados) y solo si hubo consentimiento.

A GA4 no se envía ningún dato personal: solo `client_id`, sesión, pedido y productos.

### 6. Google Ads por GA4

La conversión de compra se importa a Google Ads desde GA4 (vínculo de cuentas). Evita una segunda integración (conversiones offline por `gclid`) para el mismo dato. `KORA_GOOGLE_ADS_ID` solo añade la etiqueta de remarketing en el navegador.

### 7. Configuración: apagado, encendido o no arranca

Mismo patrón que almacenamiento, correo y datos legales: `assertMeasurementConfigured` entra en `startup-guards.ts`. Nada `NEXT_PUBLIC_*`: el layout de la tienda (ya dinámico) lee la configuración y se la pasa al componente cliente. En pruebas se usa `KORA_META_TEST_EVENT_CODE` para que los eventos caigan en la pestaña de pruebas de Meta.

### 8. La política de privacidad sigue a la configuración

`LegalContext` gana `medicion?: boolean`, que pone `legalContext()` leyendo la configuración. Con medición encendida la sección *Cookies* describe las cookies de Meta y Google; apagada conserva el texto aprobado. Así el texto nunca afirma algo que la tienda no hace, en ninguno de los dos sentidos.

## Riesgos

- **Cambio de texto legal aprobado.** El cliente aprobó la política el 23 sep; esta versión requiere su visto bueno antes de encender la medición en producción.
- **Tasa de aceptación.** Con consentimiento previo se medirá una fracción de las ventas. Es el precio de cumplir la Ley 1581; las plataformas modelan el resto.
- **Versión del API de Meta.** Fijada en `META_GRAPH_VERSION`; Meta retira versiones cada ~2 años.
