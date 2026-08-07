## Purpose

La experiencia de compra en teléfono: qué navegación sustituye a la de escritorio, cómo se reparte el espacio vertical, y qué garantías táctiles y de área segura tiene que cumplir para que se pueda comprar con una mano.

## ADDED Requirements

### Requirement: La navegación móvil es propia, no la de escritorio encogida

En pantallas de teléfono el sistema SHALL presentar: un header de una fila, una banda de búsqueda, y una **barra inferior fija de cuatro accesos** (Inicio, Catálogo, Carrito, Cuenta). Las categorías, que en escritorio ocupan una fila completa del header, SHALL vivir en un menú lateral.

El sistema NO SHALL mostrar simultáneamente el chrome de escritorio y el móvil.

#### Scenario: Teléfono

- **WHEN** se abre cualquier página pública en un ancho de teléfono
- **THEN** se ve el header de una fila, la banda de búsqueda y la barra inferior de cuatro accesos, y **no** la barra de categorías ni la línea de WhatsApp del header de escritorio

#### Scenario: Escritorio

- **WHEN** se abre la misma página en un ancho de escritorio
- **THEN** se ve el header de dos filas de siempre, y **no** la barra inferior

#### Scenario: Ancho mínimo soportado

- **WHEN** se abre la tienda a 360 px de ancho
- **THEN** ningún elemento del chrome se desborda horizontalmente ni obliga a desplazar la página de lado

### Requirement: El header cede espacio al contenido, la búsqueda no

El header SHALL ocultarse al desplazarse hacia abajo y reaparecer al desplazarse hacia arriba. La banda de búsqueda SHALL permanecer visible siempre.

En un catálogo, buscar es la acción que más se repite; la identidad de marca no. Ocultar las dos devolvería espacio a costa de la función más usada.

#### Scenario: El comprador baja por el catálogo

- **WHEN** se desplaza hacia abajo más allá del umbral
- **THEN** el header se oculta y la banda de búsqueda sigue accesible

#### Scenario: El comprador sube

- **WHEN** se desplaza hacia arriba
- **THEN** el header reaparece sin necesidad de llegar al principio de la página

#### Scenario: Vuelta al principio

- **WHEN** la página está cerca de su inicio
- **THEN** el header está visible, sea cual sea el último sentido del desplazamiento

#### Scenario: Movimiento mínimo

- **WHEN** el desplazamiento es menor que el umbral
- **THEN** el header no cambia de estado, para que un temblor no lo haga parpadear

### Requirement: La barra inferior respeta el área segura y no tapa el contenido

La barra inferior SHALL sumar `env(safe-area-inset-bottom)` a su relleno, y el contenido de la página SHALL reservar un hueco equivalente a su altura más esa área.

Sin lo primero, en un teléfono con barra de gestos los accesos quedan debajo de ella. Sin lo segundo, el último elemento de cada página queda tapado — y en el carrito y el checkout el último elemento es el botón que cierra la compra.

#### Scenario: Teléfono con barra de gestos

- **WHEN** se abre la tienda en un dispositivo con área segura inferior
- **THEN** los cuatro accesos quedan por encima de ella y son pulsables

#### Scenario: Final de una página larga

- **WHEN** se llega al final del carrito
- **THEN** el botón de continuar es visible y pulsable, sin quedar bajo la barra inferior

### Requirement: Cada acceso de la barra inferior es pulsable con el pulgar

Cada acceso SHALL tener un área táctil de al menos 44×44 px. El acceso correspondiente a la sección actual SHALL distinguirse por icono relleno y etiqueta destacada.

#### Scenario: Sección actual

- **WHEN** el comprador está en el catálogo
- **THEN** el acceso "Catálogo" aparece marcado como actual y anunciado como tal a un lector de pantalla

#### Scenario: Ficha de producto

- **WHEN** el comprador abre la ficha de un producto
- **THEN** el acceso "Catálogo" sigue marcado como actual: la ficha pertenece al catálogo, y apagar los cuatro accesos haría parecer que se está fuera de la tienda

#### Scenario: Carrito con artículos

- **WHEN** hay artículos en el carrito
- **THEN** el acceso "Carrito" muestra la cantidad, y coincide con la que muestra el header

### Requirement: El menú lateral da acceso a las categorías y no deja la página a la deriva

El menú lateral SHALL listar las categorías reales del catálogo, el acceso a la cuenta, el contacto por WhatsApp y las páginas legales.

Mientras esté abierto, la página de detrás NO SHALL desplazarse. SHALL poder cerrarse con la tecla de escape y tocando fuera.

#### Scenario: Abrir y cerrar

- **WHEN** el comprador abre el menú y toca fuera del panel
- **THEN** el menú se cierra y la página queda en la misma posición en que estaba

#### Scenario: Categorías reales

- **WHEN** se abre el menú
- **THEN** las categorías que aparecen son las del catálogo, con su color e icono, y llevan al listado filtrado por esa categoría

#### Scenario: Legibilidad del distintivo de categoría

- **WHEN** se muestra el distintivo de una categoría
- **THEN** su contenido contrasta con el fondo de color de la categoría
