## Why

**Pertenece al constructor de productos (CAT), módulo base de la cotización, semanas S2–S3.** No hay HU escrita para él: el backlog registra CAT como "pendiente de escribir". Este cambio la define de hecho, y conviene decirlo en vez de fingir que traza contra algo.

Hoy una variante es **una fila suelta con un nombre libre**: `"Talla M"`, `"Rojo"`, `"Talla M / Rojo"`. Eso falla en tres sitios:

- **En el panel se ven todas sueltas.** Un producto con seis variantes es una lista de seis nombres sin estructura; nada dice que tres son tallas y dos son colores.
- **En la ficha del comprador, igual**: una fila de botones donde "M" y "Azul" conviven sin decir de qué son. Cualquier tienda —KOAJ, la referencia que trajo Daniel— presenta **Talla** y **Color** como dos selectores separados, con las combinaciones sin stock tachadas.
- **Y lo que se vende es el CRUCE.** Una camiseta talla M azul no es "M" ni es "Azul": es M+Azul, con su propio SKU, su precio y su stock. Con nombres libres, el operador escribe "M / Azul" a mano y nada garantiza que existan las cuatro combinaciones ni que no falte una.

## What Changes

- **Opciones con valores**: un producto declara grupos (`Talla`, `Color`) y cada grupo sus valores (`M`, `S` / `Azul`, `Rojo`). El padre con sus hijos.
- **Una variante es una COMBINACIÓN** de un valor por grupo, con su SKU, sus cuatro precios y su stock. El panel las genera desde los grupos en vez de pedirlas escritas a mano.
- **La ficha muestra un selector por grupo.** Elegir valores resuelve la variante; un valor sin ninguna combinación disponible se ve **tachado**, como en la referencia.
- **`variant.name` SIGUE SIENDO el nombre visible** (`"M · Azul"`), ahora derivado de los valores. Es lo que acota el cambio: los 23 sitios que lo leen —carrito, pedidos, correos, WhatsApp, POS— no se tocan.
- **El importador acepta las DOS formas** (decisión de Daniel): la columna `Variante` de texto libre sigue creando una variante sin grupos, y las columnas nuevas de opción/valor crean la estructura. El cliente puede llenar la plantilla que ya tiene.
- **Producto sin variantes**: sin grupos declarados, sigue habiendo una sola variante "Única" y el operador no ve la palabra "variante" en ninguna parte.

## Capabilities

### New Capabilities
- `product-options`: los grupos de opciones de un producto, sus valores, y cómo se convierten en variantes vendibles — incluido qué pasa cuando falta una combinación o se borra un valor que ya vendió.

### Modified Capabilities
Ninguna publicada. `catalog-card` no cambia de requisitos.

## Impact

- **Datos**: tres tablas nuevas (`product_options`, `product_option_values`, `variant_option_values`) y migración aditiva. `variants` no pierde ninguna columna: `name` pasa a derivarse pero se sigue guardando, que es lo que deja intacto todo lo que lo lee.
- **Código**: nuevo `src/modules/catalog/options/`; el formulario de producto gana el constructor de grupos y la matriz; `(tienda)/producto/[slug]` gana un selector por grupo; `catalog/import/` acepta las columnas nuevas.
- **⚠️ Lo que NO cambia, y es deliberado**: el carrito sigue guardando `variantId`, el pedido sigue con su snapshot y `resolvePrice()` sigue siendo la única fuente de precio. Una combinación es una variante como cualquier otra.
- **Riesgo real**: un catálogo con dos grupos de cuatro valores son 16 SKU que alguien tiene que llenar. El panel debe hacer barato lo repetitivo (precios y stock en bloque) o el operador no lo usará y volverá al texto libre.

## Fuera de alcance

- Más de dos grupos por producto en la primera versión: con tres, la matriz crece a decenas de filas y el panel necesita otra pantalla.
- Fotos por valor de opción (la foto azul al elegir Azul). Es lo siguiente que se pide siempre; no está pedido.
- Guía de tallas, muestras de color reales (los cuadritos de KOAJ) y stock por punto de venta.
- Reescribir los 23 sitios que leen `variant.name`. Se conserva a propósito.
