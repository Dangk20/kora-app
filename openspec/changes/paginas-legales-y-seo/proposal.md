# Páginas legales y SEO básico de la tienda

**Semana del plan:** ninguna. El plan técnico §4 no contempla páginas legales ni SEO en ninguna de las 18 semanas; §5 solo las roza como riesgo (*"Habeas Data (Ley 1581): opt-in/opt-out no es opcional, es legal"*, plan técnico línea 176).

**HU de referencia:** **ninguna**. Se revisaron `hus-tienda.md`, `hus-catalogo.md`, `hus-pedidos.md` y `hus-clientes.md`: no existe HU de páginas legales, de política de cambios ni de indexación. Tampoco aparecen en `business/alcance-detallado-desarrollo-kora.md`.

**⚠️ ALCANCE NUEVO — no está en la cotización firmada.** Igual que los correos transaccionales, esto se construye porque sin ello la tienda no puede abrirse al público, no porque estuviera vendido. Decidir si se cobra, se negocia o se absorbe es de Daniel. Coste estimado: ~medio día.

## Why

El cliente empieza a vender en línea la semana del 10 de agosto. Hoy la tienda está funcionalmente completa pero **no puede publicarse**, por dos razones que no son de producto:

1. **Legal.** El checkout pide al comprador que *"autorizo el tratamiento de mis datos personales"* (`checkout-view.tsx:376`) sin enlazar a ninguna política — es decir, pide autorización para algo que no está escrito en ningún sitio. Ante la SIC, un consentimiento que no dice a qué se consiente no es consentimiento (Ley 1581/2012, art. 9 y Decreto 1377/2013, art. 5). No hay términos de venta, no hay política de cambios publicada, y el Estatuto del Consumidor obliga a que las ventas a distancia informen previamente el derecho de retracto (Ley 1480/2011, art. 47).
2. **Comercial.** No existe `robots.ts` ni `sitemap.ts`. Una tienda que abre sin ellos tarda semanas en aparecer en Google, y el catálogo —que es el activo— queda invisible.

Ninguna de las dos se resuelve después: la primera es requisito para operar, la segunda pierde su valor si se hace tarde.

## What Changes

- **Tres páginas legales bajo `/legal/*`**, servidas dentro del layout de la tienda:
  - `/legal/datos-personales` — política de tratamiento de datos: finalidades, responsable, derechos del titular (conocer, actualizar, rectificar, suprimir, revocar), canal de atención y plazos de respuesta.
  - `/legal/terminos` — condiciones de venta: que **no hay pasarela de pago** y el cobro se coordina por WhatsApp fuera de la plataforma, doble moneda sin conversión, disponibilidad sujeta a confirmación, vigencia de 2 h del pedido, y las reglas de Kora Cashback.
  - `/legal/cambios` — política de cambios (30 días calendario, producto nuevo con etiquetas y empaque), **más** el derecho de retracto y la garantía legal, que son irrenunciables.
- **Datos del comerciante como marcadores obligatorios.** Razón social, NIT, domicilio y correo de contacto no los tenemos. Se declaran en un único módulo de configuración legal y **la aplicación no arranca en producción si están vacíos** — mismo patrón y misma lección que R2 y que el proveedor de correo: una página legal con `[RAZÓN SOCIAL]` publicada es peor que no tenerla.
- **Los enlaces existen donde se necesitan**: footer de la tienda y, sobre todo, dentro del texto del consentimiento del checkout.
- **`robots.ts` y `sitemap.ts`**, con el sitemap generado sobre el catálogo real (categorías + productos publicados) y `noindex` preservado en staging.
- **Metadata Open Graph** en home, catálogo y ficha de producto, para que un enlace compartido por WhatsApp —el canal del negocio— muestre el producto y no una tarjeta vacía.

### ⛔ Conflicto legal encontrado, que necesita decisión del cliente

`business/kora-cashback-reglas-cliente.md` §6 afirma: **"KORA no realiza devoluciones de dinero. Únicamente se aceptan cambios de producto."** Publicado tal cual en una tienda online colombiana, ese texto es una **cláusula abusiva** (Ley 1480/2011, arts. 42–43) y es inaplicable en dos casos que la ley no deja renunciar por contrato:

- **Derecho de retracto** (art. 47): en toda venta a distancia el comprador puede retractarse dentro de los **5 días hábiles** siguientes a la entrega y el vendedor debe **devolver el dinero**. KORA vende a distancia por definición.
- **Garantía legal** (arts. 7–8): ante un producto defectuoso el consumidor elige, y la devolución del dinero es una de las opciones.

La política de cambios de 30 días del cliente es **más generosa** que el mínimo legal y se publica tal cual — pero convive con esos dos derechos, no los sustituye. Este change escribe la página de forma que ambas cosas sean ciertas, y **la redacción final requiere el visto bueno del cliente** antes del go-live.

## Capabilities

### New Capabilities
- `legal-pages`: páginas legales públicas de la tienda, los datos del comerciante que las sostienen, y la garantía de que no se publican sin llenar.
- `store-seo`: indexación de la tienda — `robots`, `sitemap` sobre el catálogo real, y metadata para compartir.

### Modified Capabilities
Ninguna. `email-consent` regula el consentimiento de marketing y no cambia: aquí solo se le añade el enlace a la política que ya debía existir.

## Impact

**Código nuevo**
- `src/modules/legal/` — configuración del comerciante, comprobación de arranque (mismo patrón que `src/modules/storage/config.ts`) y el contenido de las tres páginas.
- `src/app/(tienda)/legal/[...]/page.tsx` — las tres rutas.
- `src/app/robots.ts`, `src/app/sitemap.ts`.

**Código tocado**
- `src/app/(tienda)/layout.tsx` — enlaces legales en el footer.
- `src/app/(tienda)/checkout/checkout-view.tsx` — el consentimiento enlaza a la política.
- `src/instrumentation.ts` — se suma la comprobación legal a la de almacenamiento.
- `.env.example` y `deploy/.env.*` — las variables del comerciante.
- Metadata en `(tienda)/page.tsx`, `catalogo/page.tsx`, `producto/[slug]/page.tsx`.

**Insumos del cliente que esto convierte en bloqueo de go-live**
1. Razón social, NIT, domicilio y correo de contacto legal. **Sin esto producción no arranca**, por diseño.
2. Visto bueno de la redacción de las tres páginas, en particular la de cambios y su convivencia con el retracto.
3. Correo de atención al titular de datos — hoy no existe buzón en `@korashopp.com` (Google Workspace quedó aplazado), así que tiene que ser una dirección que ya exista.

**Fuera de alcance**
- Registro de la base de datos personales ante la SIC (trámite del cliente, no software).
- Aviso de cookies: la tienda no usa analítica ni rastreo de terceros; sus cookies son estrictamente necesarias (sesión del comprador, moneda, carrito) y no requieren banner de consentimiento. Si más adelante se instala Meta Pixel o Google Analytics, deja de ser cierto y **entonces** hace falta el banner.
- Redacción por abogado. Aquí se escribe una base sólida y trazable a las normas citadas; la validación jurídica formal es decisión del cliente.
- SEO avanzado: datos estructurados de producto (schema.org), canonical multi-moneda, hreflang. Van después de vender.
