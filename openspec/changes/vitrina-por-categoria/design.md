## Decisiones

**El elemento guarda la categoría, no sus productos.** Copiar los productos al agregar la categoría dejaría la sección congelada; guardar la categoría hace que un producto nuevo de la línea entre solo, que es lo que se pide. `showcase_items` lleva `productId` O `categoryId` (CHECK en base); dos índices únicos por sección impiden repetir uno u otro.

**La expansión es una función pura** (`expandirElementos` en `src/modules/showcase/expand.ts`): recibe los elementos ordenados y el catálogo publicado ya cargado, y devuelve la lista final sin repetidos. Se prueba sin base. `getShowcase` ya cargaba el catálogo una vez para las secciones manuales; ahora lo hace si hay cualquier elemento.

**Tope de 12 productos por categoría.** Es el mismo número que el modo automático trae para rotar (`limit × 2`, máx. 12). Sin tope, "Mujer" metería 106 productos en la portada.

**Orden dentro de una categoría = orden del catálogo** (destacados primero, luego recientes): el que ya usa `listProducts`. No se inventa otro.

**Selectores previos en un componente nuevo** (`item-picker.tsx`), no en `ProductPicker`: ese lo usan también los banners y las campañas, que solo eligen productos. La búsqueda de productos acepta un filtro de categoría opcional (padre incluye subcategorías), el mismo criterio que la tienda.

**Categorías: un modal de edición** en lugar del renombrado escribiendo sobre el título, que nadie descubría. `updateCategory` ya aceptaba nombre, color e ícono; no cambia. El conteo del padre se suma en la página.

## Riesgo asumido

- Una categoría en "Ofertas" muestra sus productos aunque no estén en oferta: el operador eligió la categoría. Si se quiere "solo los rebajados de la categoría", es otro cambio.
