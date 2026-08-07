## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño:

- Las pantallas públicas **no tienen ninguna media query**: `layout.tsx` y `product-card.tsx` tienen cero clases responsive; el resto, dos o tres. Comprobado.
- La referencia ya no es nuestra: `../design-handoff/Kora-Movil-Spec.dc.html` (especificación) y `Kora-Movil-Prototipo.dc.html` (prototipo), importados el 7 ago del proyecto de Claude Design.
- Los tokens del diseño **ya existen** en `globals.css`: `kora-orange #ff6a00`, `kora-coral #ff5a1f`, `kora-pink #f2357e`, `kora-magenta #c026d3`, `kora-purple #7a3db8`, `kora-black #121212`. No hay que introducir ni un color nuevo.
- Ya existen piezas reutilizables que el diseño pide: `CategoryTile` + `inkFor` (pastel con tinta legible), `CartProvider`, `resolvePrice()`.

## Goals / Non-Goals

**Goals**

- Que se pueda comprar con una mano, desde 360 px.
- Fidelidad a la especificación importada: alturas, pesos, colores y comportamientos salen de ahí.
- No duplicar lógica: la misma tienda, otra presentación.

**Non-Goals**

- Panel de administración y tienda de escritorio. Ver `proposal.md` — Fuera de alcance.
- Aplicación nativa o PWA instalable.
- Optimizar Lighthouse como objetivo separado. Se medirá al cerrar el bloque; perseguir la métrica antes de tener las pantallas sería optimizar lo que aún no existe.

## Decisions

### 1. Chrome móvil como componentes propios, no el de escritorio con clases responsive

`src/modules/storefront/mobile/` con `mobile-chrome.tsx` (header + barra inferior + hueco), `mobile-menu.tsx` y `mobile-shell.tsx` (el estado que comparten). El layout renderiza los dos y deja que el ancho decida (`lg:hidden` / `hidden lg:block`).

**Por qué no un solo árbol con clases:** no son la misma navegación adaptada, son **dos navegaciones distintas**. Escritorio tiene barra de categorías y línea de WhatsApp en el header; móvil mueve las categorías a un menú lateral y la navegación a una barra inferior que en escritorio no existe. Forzar un árbol común produce marcado que ninguna de las dos usa, y en móvil eso se paga en peso descargado.

**Coste asumido:** el marcado del header aparece dos veces en el HTML. Es aceptable —son unas decenas de elementos— y la alternativa es peor.

### 2. El header se oculta con un umbral, y cerca del tope siempre se ve

Un `useEffect` sobre `scroll` con `passive: true`, comparando contra la última posición.

- **Umbral de 8 px:** sin él, cualquier micro-desplazamiento alterna el estado y el header vibra mientras se lee. Es el defecto clásico de este patrón.
- **Siempre visible bajo 80 px:** al volver arriba de un tirón, el estado puede quedarse en "oculto" con la página ya en el principio, y el comprador se queda sin logo ni acceso al menú sin entender por qué.
- **La banda de búsqueda no se oculta:** en un catálogo, buscar es lo que más se repite.

Se usa `max-height` + `opacity` en lugar de `transform` para que el contenido suba a ocupar el hueco en vez de quedar debajo de un header invisible.

### 3. La barra inferior es `fixed` con un hueco explícito, no `sticky`

`fixed` + un `<div>` espaciador con `calc(56px + env(safe-area-inset-bottom))`.

**Por qué no `sticky` al final del flujo:** en páginas cortas quedaría a media pantalla. **Por qué un espaciador y no `padding-bottom` en `main`:** el espaciador es un elemento que se ve en el árbol y se puede inspeccionar; un relleno heredado se pierde en cuanto una página define el suyo.

`env(safe-area-inset-bottom)` no es opcional: sin él, en un iPhone con barra de gestos los cuatro accesos quedan debajo de ella.

### 4. El acceso "Catálogo" cubre también la ficha de producto

La coincidencia de ruta es una función por acceso, no una igualdad. `/producto/[slug]` marca "Catálogo".

Dejar los cuatro apagados mientras se mira un producto —que es donde el comprador pasa más tiempo— comunica "estás fuera de la tienda" justo cuando está a punto de comprar.

### 5. El distintivo de categoría reutiliza `CategoryTile` + `inkFor`

La primera versión pintó la inicial de la categoría en blanco sobre su color. Con los pasteles reales del catálogo resultó **ilegible**, y se vio en la primera captura.

`inkFor()` ya existía y resuelve exactamente esto: pastel de fondo, tinta oscura derivada. Es además lo que hace el diseño (`bg` + `ink`) y lo que ya usa el resto del sistema.

### 6. Sin cambios de datos ni de lógica

No hay migración Prisma, no se emiten ni consumen `domain_events`, no se toca ninguna Server Action, ni precios, ni stock, ni permisos. Es presentación.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El marcado del chrome se duplica** (móvil + escritorio) | Aceptado y explicado en la decisión 1. Son unas decenas de elementos; unificarlos costaría más de lo que ahorran |
| **El ocultar del header depende de un listener de scroll**, que puede ir a tirones en gama baja | `passive: true` y solo cambio de estado por encima del umbral: no hay trabajo por evento salvo una resta |
| **La barra inferior tapa contenido si una página olvida el hueco** | El hueco lo pone el layout, no cada página |
| **Fidelidad "tal cual" contra un prototipo con datos falsos** (marcas y precios inventados) | Se replica la forma, nunca el contenido: el catálogo sale de la base. Declarado en el proposal |
| **El diseño mezcla `#ff5a1f` con el gradiente oficial** en algunos acentos | Se replica tal cual, que es el encargo. Ambos son tokens que ya existen en `globals.css`; no se introduce ningún color nuevo |

## Migration Plan

No hay migración. El chrome móvil aparece solo por debajo del punto de corte `lg`; en escritorio nada cambia, lo que permite entregarlo por partes sin arriesgar lo que ya funciona.

Rollback: revertir el commit.

## Open Questions

- **Autocompletado en vivo del buscador.** El diseño de escritorio lo tiene; el móvil no lo especifica. Hoy la búsqueda navega al catálogo. Se decide al llegar a la vista de catálogo, y no cambia el chrome.
