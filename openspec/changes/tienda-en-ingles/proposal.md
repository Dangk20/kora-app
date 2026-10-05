## Why

**Alcance NUEVO, fuera de la cotización** — pedido por Daniel el 5 oct 2026, día de la apertura. El alcance firmado pide doble moneda (TIE_HU001), no doble idioma. Quien entra desde fuera de Colombia ya ve la tienda en USD; verla en español es la siguiente barrera para comprar: la mayoría de compradores en EE. UU. que pagan para un familiar en Colombia leen español, pero no todos, y la tienda no da ninguna señal de estar pensada para ellos.

## What Changes

- **Idioma del visitante anclado al mismo origen que la moneda**: desde fuera de Colombia, inglés; desde Colombia o sin saberlo, español. Toda duda cae del lado español, como la moneda cae del lado COP.
- **Selector de idioma ES | EN** junto al de moneda, en escritorio y móvil. La elección manual se guarda y prevalece sobre la detección.
- **Toda la interfaz de la tienda en inglés**: header, navegación, portada, catálogo, ficha, carrito, checkout, puente de WhatsApp, cuenta del comprador, buscador, pie, versión móvil y mensajes de error que ve el comprador.
- **Contenido del catálogo en inglés**: título y descripción de producto y nombre de categoría tienen versión en inglés, editable en el panel. Sin traducción, se muestra el español (nunca un hueco). Las traducciones iniciales de los 351 productos las prepara el equipo y el cliente las revisa.
- **Fuera de esta entrega** (decisión de Daniel): correos, comprobante PDF, mensaje de WhatsApp y páginas legales siguen en español. El panel sigue en español.

## Capabilities

### New Capabilities
- `storefront-locale`: qué idioma ve el visitante, cómo lo cambia, y qué se traduce y qué no.

### Modified Capabilities
Ninguna publicada.

## Impact

- **Datos**: columnas opcionales `nameEn` y `descriptionEn` en `products`, `nameEn` en `categories`. Migración aditiva.
- **Código**: módulo nuevo `src/modules/i18n/` (detección, diccionarios, proveedor para componentes cliente); todos los componentes de `src/app/(tienda)/` y `src/modules/storefront/`, `cart`, `buyer` dejan de tener texto fijo; las consultas de la tienda reciben el idioma.
- **No cambia**: precios, moneda, stock, pedidos, panel, correos.
