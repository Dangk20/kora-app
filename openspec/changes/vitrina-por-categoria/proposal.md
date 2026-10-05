## Why

**Alcance §Vitrina (módulo base) y §Catálogo — ajuste pedido por Daniel el 4 oct 2026, un día antes de la apertura.** Con el catálogo real cargado (349 productos en 8 líneas) aparecieron tres fricciones:

- **Armar una sección a mano es buscar producto por producto.** En "Yo elijo" solo se puede agregar un producto suelto, buscándolo por nombre. Para "Ofertas que están encendidas" con toda la línea de Juguetes hay que agregarlos uno a uno, y cuando se carga un producto nuevo de esa línea no aparece solo.
- **Categorías dice "0 productos" en todas las líneas.** El conteo mira solo los productos asignados directamente a la categoría padre, y el importador los asigna a la subcategoría. El panel afirma un dato falso.
- **No se ve cómo editar una categoría.** El nombre se puede cambiar escribiendo encima del título (nadie lo descubre) y el ícono de una subcategoría no se puede cambiar.

## What Changes

- **"Yo elijo" agrega PRODUCTO o CATEGORÍA, con selectores previos**: primero se elige qué agregar; luego Categoría y, si se quiere, Subcategoría. Con "Producto", la lista se filtra por esos selectores; con "Categoría", se agrega la categoría (o subcategoría) entera.
- **Una categoría agregada es dinámica**: la sección muestra sus productos publicados (una categoría padre incluye sus subcategorías), con un tope por elemento para que la portada no cargue la línea entera. Un producto nuevo de esa categoría entra solo.
- Aplica a las cuatro secciones de productos de la Vitrina: Productos destacados, La mejor elección de la semana, Mejor valorados y Ofertas que están encendidas.
- **Categorías**: botón visible de editar para categoría y subcategoría (nombre e ícono; color en la categoría padre). El conteo de la categoría padre suma el de sus subcategorías.

## Capabilities

### New Capabilities
- `showcase-sources`: qué puede contener una sección manual de la Vitrina y cómo se resuelve en la tienda.
- `category-admin`: edición de categorías y subcategorías y el conteo de productos que se muestra.

### Modified Capabilities
Ninguna publicada.

## Impact

- **Datos**: `showcase_items.productId` pasa a opcional y se añade `categoryId` (FK a `categories`, borrado en cascada), con un CHECK de que lleva exactamente uno de los dos. Migración aditiva: los elementos existentes siguen siendo de producto.
- **Código**: `src/modules/showcase/` (resolución y acciones), `src/app/admin/vitrina/` (modal y selector), `src/app/admin/catalogo/categorias/`.
- **Sin cambios** en la tienda fuera de la Vitrina, ni en permisos (`catalog:edit` como hasta hoy).
