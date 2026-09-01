## 1. Datos

- [x] 1.1 Modelos `ProductOption`, `ProductOptionValue` y `VariantOptionValue` en el esquema, con sus índices únicos por producto y por opción.
- [x] 1.2 Migración aditiva, sin backfill: las variantes actuales se quedan sin opciones y siguen funcionando.
- [x] 1.3 `pnpm db:migrate` y comprobar que el catálogo existente no cambia.

## 2. Reglas — `src/modules/catalog/options/`

- [x] 2.1 Declarar grupos y valores de un producto, con su orden.
- [x] 2.2 Componer el nombre visible de una variante desde sus valores ("M · Azul"). **Un solo escritor.**
- [x] 2.3 Generar las combinaciones propuestas desde los grupos, sin crearlas.
- [x] 2.4 Resolver la variante a partir de una selección de valores, y decir qué valores quedan alcanzables.
- [x] 2.5 Proponer el SKU de una combinación desde el código base y los valores, sin abreviarlos.
- [x] 2.6 Borrar un valor: informar cuántas unidades publicadas se pierden antes de confirmar.

## 3. El panel

- [x] 3.1 Constructor de grupos: agregar grupo, agregar valores, reordenar, borrar con aviso.
- [x] 3.2 Matriz de combinaciones: una fila por cruce, con SKU, cuatro precios y stock.
- [x] 3.3 SKU propuesto y editable por fila, con aviso de repetido ANTES de guardar.
- [x] 3.4 Precios y stock **en bloque** para toda la matriz, con ajuste por fila.
- [x] 3.5 Sin grupos declarados, el formulario se comporta como el modo simple actual.

- [ ] 3.6 El buscador del panel encuentra también por código de barras.

## 3bis. El alta por pasos

- [x] 3b.1 Modal centrado y grande para el ALTA; el panel lateral se conserva para editar.
- [x] 3b.2 Paso 1 "Qué es": nombre, marca, categoría, descripción, fotos, activo y destacado.
- [x] 3b.3 Paso 2 "Cómo se vende": interruptor de variantes, grupos, valores y matriz con SKU y precios.
- [x] 3b.4 Paso 3 "Cuánto hay": stock por combinación, en una tabla que se llena de un vistazo.
- [x] 3b.5 Volver atrás conserva lo escrito; el paso actual siempre visible.
- [ ] 3b.6 Ayuda por campo donde el nombre no basta (SKU, código de barras, precio online vs tienda, cupo online).
- [x] 3b.7 ⚠️ El stock inicial entra por `receiveStock()` del motor, no escribiendo `stockActual` a mano.

## 4. La ficha del comprador

- [ ] 4.1 Un selector por grupo, rotulado con su nombre.
- [ ] 4.2 Los valores sin ninguna combinación alcanzable se ven tachados.
- [ ] 4.3 Con un solo grupo o sin grupos, el comportamiento es el de hoy.

## 5. El importador

- [ ] 5.1 Columnas nuevas de opción y valor en `columns.ts` — la única fuente de la plantilla.
- [ ] 5.2 La columna `Variante` de texto libre sigue creando una variante sin grupos.
- [ ] 5.3 Un producto que mezcla las dos formas rechaza el archivo entero, señalando la fila.

## 6. Tests

- [ ] 6.1 El nombre visible se deriva de los valores y lo escribe una sola función.
- [ ] 6.2 Renombrar un valor no toca los pedidos ya creados.
- [ ] 6.3 Un valor sin combinaciones alcanzables se ofrece como no elegible.
- [ ] 6.4 Una combinación inexistente se comporta como agotada, no como comprable.
- [ ] 6.5 El importador acepta las dos formas y rechaza la mezcla.
- [ ] 6.6 El stock inicial de una combinación entra por el motor de inventario.

## 7. Cierre

- [ ] 7.1 Anotar el alcance nuevo y la deuda del nombre derivado en `../notas-tecnicas-privado.md`.
- [ ] 7.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
