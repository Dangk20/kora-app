# Tienda móvil, contra el diseño aprobado

**Semana del plan:** S6 (15–21 ago, *"Tienda: búsqueda + móvil"*), con el DoD 🎯 *Lighthouse >90 móvil*. Se adelanta.

**HU de referencia:** ninguna HU nueva. Es la misma tienda (TIE_HU001–002, CAT_HU001, PED_HU001–002) en la pantalla donde va a comprar la mayoría.

**Alcance:** dentro de lo cotizado. El plan pide el pase móvil en S6.

**Referencia de diseño (nueva, 7 ago):** `../design-handoff/Kora-Movil-Spec.dc.html` (especificación) y `Kora-Movil-Prototipo.dc.html` (prototipo navegable), importados del proyecto de Claude Design que Daniel señaló. **Sustituyen a la invención**: hasta hoy el pase móvil se iba a diseñar sobre la marcha.

## Why

La tienda está construida y **no tiene una sola media query en las pantallas públicas**. Se comprobó a 390 px: el buscador del header se desborda, la barra de categorías se corta, y el layout de escritorio se arrastra a un teléfono. El cliente empieza a vender la semana del 10 de agosto y en Colombia la mayoría de las compras de una tienda así ocurren en el teléfono: entregar solo el escritorio es entregar la mitad del producto.

Hasta hoy el pase móvil habría sido diseño improvisado por nosotros. Ya no: existe un diseño aprobado, **posterior al sistema actual**, que además llega alineado con decisiones que el código ya tomó.

## Lo que el diseño confirma, y por qué importa

El spec móvil coincide con reglas que ya están implementadas y documentadas en las notas privadas, sin que nadie se las hubiera pasado:

- *"Sin pasarela de pago: el checkout genera el pedido y abre WhatsApp."*
- *"Sin estrellas, sin wishlist, sin urgencia falsa, sin promesas de envío gratis ni cuotas."* — es literalmente la decisión que se tomó al construir la tienda pública.
- *"Disponible depende del cupo online, no del stock total."*
- *"Saldo de Kora Cashback (nunca puntos)."*
- Card **sin botón de agregar**, con el argumento explícito: *"la compra se decide en la ficha"* y *"un agregar desde la card genera carritos con la variante equivocada"*.

**No hay conflicto con el manual de marca.** Estos archivos usan Manrope, Allura y el gradiente oficial `#ff6a00 → #c026d3 / #7a3db8`; no son el prototipo de junio, cuyos tokens provisionales (Poppins/Inter/Playfair, naranja fuego) quedaron reemplazados el 18 de julio.

## What Changes

- **Chrome móvil**: header negro de una fila que **se oculta al bajar y reaparece al subir**, banda de marca con buscador siempre visible, y **barra inferior fija de 4 accesos** con `env(safe-area-inset-bottom)` de iOS.
- **Home**: hero 4:5 con bullets, círculos de categoría con desplazamiento horizontal, rejilla de 2 columnas, beneficios 2×2, carruseles con **peek** de la card siguiente, banner de cashback y footer compacto.
- **Catálogo**: chips de categoría pegajosos, **bottom-sheets** para Filtros y Ordenar, rejilla de 2 columnas y **"Cargar más"** — nunca paginación numérica.
- **Ficha**: galería a sangre, chips de variante, acordeones para el contenido largo, y **barra sticky de compra que reemplaza a la de navegación** al aparecer (nunca se superponen).
- **Carrito y checkout**: carrito como página completa; checkout de **un solo paso** con campos de 48 px y resumen colapsable, terminando en WhatsApp con la vigencia de 2 h.
- **Cuenta**: entrar/crear, mis pedidos, detalle y saldo de cashback.
- **Estados**: cargando (skeleton), carrito vacío, producto agotado y error de red.
- **Diseñado desde 360 px**, no desde 390.

## Capabilities

### New Capabilities
- `mobile-store`: la experiencia de compra en teléfono — navegación, densidad, áreas táctiles y los patrones que sustituyen a los de escritorio.

### Modified Capabilities
Ninguna publicada. No cambia ninguna regla de negocio: es la misma tienda en otra pantalla.

## Impact

**Código tocado** — `src/app/(tienda)/layout.tsx` (chrome), `page.tsx` (home), `catalogo/`, `producto/[slug]/`, `carrito/`, `checkout/`, `cuenta/`, y `src/modules/storefront/` (cards, secciones de portada).

**Sin cambios** en base de datos, precios, stock, permisos ni estados de pedido. Ninguna Server Action se toca.

**Fuera de alcance de ESTE change** (y conviene decirlo, porque el encargo hablaba de todo):
- **Panel de administración.** Ya tuvo su pase de fidelidad contra `Kora.dc.html` el 18 de julio, y el operador trabaja en escritorio. Si hace falta un repaso, es un change aparte con su propia revisión — no se mezcla con el móvil de la tienda.
- **Tienda de escritorio.** Construida contra el mismo prototipo. Merece una verificación pantalla por pantalla, que es trabajo distinto de construir el móvil.
- **POS** (S9), que en el prototipo móvil no aparece.

**Deuda que se acepta:** el prototipo trae datos de ejemplo con marcas reales (Nike, Lenovo, Imusa) y precios inventados. Se replica la **forma**, nunca el contenido: el catálogo sale de la base.
