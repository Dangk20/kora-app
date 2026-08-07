# Correcciones de la auditoría de fidelidad (escritorio)

**Semana del plan:** ninguna. Es corrección de defectos encontrados en la auditoría del 7 ago (`docs/auditoria-fidelidad-escritorio.md`).

**HU de referencia:** ninguna nueva. Afecta a TIE_HU001/002 (tienda) y PED_HU003 (panel de pedidos).

**Alcance:** dentro de lo cotizado — son defectos de lo ya construido.

## Why

La auditoría comparó la aplicación contra el prototipo aprobado y separó diez diferencias en defectos, decisiones pendientes y desvíos deliberados. Este change corrige las cuatro que Daniel aprobó el 7 ago; el resto queda en la auditoría esperando decisión o planificación.

Dos de las cuatro no son cuestión de estética: **contradicen reglas escritas del propio proyecto**, y una regla que el código incumple deja de servir como regla.

## What Changes

### 1. El dashboard deja de mostrar el enum de la base

`src/app/admin/page.tsx:249` imprime `{o.status}` — es decir `CONFIRMED`, `PREPARING` — en la tabla *Últimos pedidos*. En un panel en español, en la primera pantalla que ve el operador al entrar.

El sistema **ya sabe hacerlo bien**: `STATUS_LABEL` y `STATUS_STYLE` existen en `src/modules/orders/status.ts` y los usan las otras tres pantallas de pedidos, con badge de color. Solo esta se saltó el formateador.

### 2. Las cards de producto pierden el botón

`CLAUDE.md:78` dice: *"Las cards del catálogo **no llevan botón**: la compra se decide en la ficha."* El código las pinta con **"Agregar"** o **"Ver opciones"**.

**Decisión de Daniel (7 ago): se quita el botón.** El prototipo de junio lo tiene y el diseño móvil de agosto explícitamente no, con el argumento que aplica a este negocio:

> *"En KORA el pedido termina en WhatsApp y muchos productos tienen variantes: un 'agregar' desde la card genera carritos con la variante equivocada y fricción al corregirla."*

Toda la card pasa a ser un enlace: **más área táctil, menos ruido, y el precio —que es lo que más se compara— gana el espacio que ocupaba el botón.**

### 3. La ficha recupera el bloque de garantías

El prototipo pone tres garantías con icono bajo los botones de compra. Hoy hay una línea de texto suelta. El home ya tiene esa fila, con las tres que el negocio sostiene de verdad; la ficha —donde se decide la compra— no.

Se reutilizan **las mismas tres del home**, no las del prototipo: las del prototipo prometen devoluciones a 7 días y envíos rápidos, que es justo lo que se decidió no publicar.

### 4. El orden de los botones de compra vuelve al del prototipo

Hoy *Comprar ahora* va arriba y *Agregar al carrito* debajo; el prototipo es al revés.

## Capabilities

### Modified Capabilities
Ninguna publicada cambia de requisito. `openspec/specs/` contiene hoy solo las tres capacidades de correo, que este change no toca.

### New Capabilities
- `catalog-card`: qué muestra y cómo se interactúa con la tarjeta de producto — la pieza que más se repite en la tienda y la que la auditoría encontró en contradicción consigo misma.

## Impact

**Código tocado**
- `src/app/admin/page.tsx` — badge de estado.
- `src/modules/storefront/product-card.tsx` — quitar el botón, card enlazable completa.
- `src/modules/storefront/add-to-cart-button.tsx` — deja de usarse en la card; sigue en la ficha.
- `src/app/(tienda)/producto/[slug]/page.tsx` — garantías y orden de botones.
- `src/modules/storefront/home-layout.tsx` — de donde salen las tres garantías, para no duplicarlas.

**Sin cambios** en base de datos, precios, stock, permisos ni estados de pedido.

**Fuera de alcance** (siguen en la auditoría, esperando decisión o semana):
- F1 filtros del catálogo (S6), F2 banner de portada, F3 fila del header, F6 Categorías en el nav, F7 columna de canal, F8 acento tipográfico.
