## 1. Datos

- [x] 1.1 `ShowcaseItem.productId` opcional, `categoryId` con FK en cascada, únicos por sección, relación en `Category`.
- [x] 1.2 Migración con CHECK "exactamente uno"; `pnpm db:migrate`.

## 2. Vitrina — `src/modules/showcase/`

- [x] 2.1 `expand.ts`: expansión pura de elementos a productos (tope por categoría, sin repetidos) + prueba.
- [x] 2.2 `getShowcase` resuelve elementos de categoría y devuelve la lista de elementos para el editor.
- [x] 2.3 Acciones: agregar categoría, quitar y mover por elemento; búsqueda de productos con filtro de categoría; árbol de categorías para los selectores.

## 3. Panel de Vitrina

- [x] 3.1 Selector con pasos previos: Producto | Categoría → Categoría → Subcategoría (opcional) → producto o "agregar categoría".
- [x] 3.2 El modal lista productos y categorías con su tipo, reordena y quita por elemento.

## 4. Categorías

- [x] 4.1 El conteo del padre suma sus subcategorías.
- [x] 4.2 Botón editar en categoría y subcategoría: nombre e ícono (+ color en el padre).

## 5. Verificación

- [x] 5.1 `pnpm typecheck`, `pnpm lint`, prueba de `expand.ts`.
- [x] 5.2 Probado en el navegador contra una base local: agregar categoría, subcategoría y producto filtrado; editar categoría y subcategoría; conteos.
