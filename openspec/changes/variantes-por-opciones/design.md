## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño:

- **`variant.name` lo leen 23 sitios** —carrito, pedidos, correos, WhatsApp, POS, buscador—. Rehacerlos convertiría este cambio en una reforma de medio sistema.
- **El pedido guarda su snapshot** y el carrito guarda solo `variantId`. Una combinación tiene que ser una variante como cualquier otra, o habría que tocar los dos.
- **El stock solo cambia dentro de `inventory/engine.ts`** (regla 1). Generar combinaciones no puede saltárselo.
- **El cliente tiene una plantilla de Excel pendiente de llenar** con la columna `Variante` como texto libre. Romperla le costaría horas de trabajo suyo.

## Goals / Non-Goals

**Goals:**
- Que el operador declare Talla y Color y el panel haga el resto.
- Que el comprador vea dos selectores y entienda qué está eligiendo.
- Cambiar lo mínimo fuera del catálogo.

**Non-Goals:**
- Fotos por valor, guía de tallas, muestras de color reales.
- Más de dos grupos por producto.
- Tocar carrito, pedidos, correos ni POS.

## Decisions

### 1. `variant.name` se CONSERVA y se deriva

Sigue siendo una columna de la variante, escrita por el sistema como `"M · Azul"` a partir de sus valores.

Es la decisión que acota todo el cambio: los 23 sitios que lo leen no se enteran. La alternativa —que cada consumidor componga el nombre desde las opciones— obligaría a tocar el carrito, el snapshot del pedido, los siete correos y el mensaje de WhatsApp, y a que todos compusieran igual. Con veintitrés implementaciones de "cómo se llama esta variante", la del correo y la del carrito se separan y nadie lo nota hasta que un comprador pregunta por qué su comprobante dice otra cosa.

Coste asumido: es un dato derivado guardado. Se recalcula en un solo sitio, al escribir opciones o valores.

### 2. Tres tablas, y la variante NO cambia de forma

```
product_options        (id, productId, name, position)
product_option_values  (id, optionId, value, position)
variant_option_values  (variantId, valueId)   ← qué valores componen la variante
```

`variants` no pierde ninguna columna. Una variante sin filas en `variant_option_values` es exactamente lo que hay hoy: una variante suelta con su nombre. **Por eso la migración no necesita backfill** y el catálogo actual sigue funcionando sin tocar un dato.

*Alternativa descartada:* guardar las opciones como JSON en la variante. Más rápido de escribir y sin forma de preguntar "¿qué tallas tiene este producto?" sin leer todas las variantes — que es justo la consulta de la ficha.

### 3. Las combinaciones se crean SOLAS; quitar es la excepción

Declarar Talla (M, S) y Color (Azul, Rojo) crea las cuatro combinaciones, con los precios del bloque de arriba. Quitar una es un gesto aparte, para el caso real de "la talla 44 solo vino en negro".

**Esto invierte la decisión original**, que era proponerlas y que el operador pulsara "Crear" en cada una. El motivo de aquella era no publicar un producto con todo en cero — pero ese riesgo lo cubren los precios en bloque, que se aplican al crearlas. Lo que sí producía era seis clics idénticos antes de poder escribir nada, y un formulario que arrastraba una variante vacía y fallaba al guardar con "Cada variante necesita SKU" sin decir cuál.

Regla que se conserva: una combinación **sin stock** se ve agotada en la tienda, no oculta. Eso es honesto; publicar sin precio no lo era.

### 4. La ficha resuelve la variante desde los valores elegidos

Un selector por grupo. Elegir un valor filtra qué valores del otro grupo siguen siendo alcanzables: si con M no hay ningún Rojo con cupo, Rojo se tacha. Es lo que hace la referencia y es lo único honesto — ofrecer un color que no se puede comprar traslada el error al final del embudo.

Con un solo grupo, el comportamiento es el de hoy.

### 5. El importador: la columna vieja gana por omisión

Si viene `Variante` con texto, se crea la variante sin grupos. Si vienen las columnas nuevas, se crea la estructura. **Un mismo producto no puede mezclar las dos formas** y el archivo se rechaza entero señalando la fila — la validación de todo-o-nada que ya tiene el importador.

Mezclarlas en silencio produciría un producto mitad estructurado y mitad suelto, que en la ficha se vería como un selector al que le faltan opciones.

### 6. Dónde vive la lógica

`src/modules/catalog/options/` — declarar grupos y valores, generar combinaciones, componer el nombre visible y resolver la variante desde una selección. El formulario y la ficha lo consumen; ninguno decide por su cuenta.

### 7. El SKU se propone con un patrón; el código de barras no se genera

`<código base del producto>-<valor1>-<valor2>`, con los valores **completos** —en mayúsculas, sin tildes ni espacios—: `CAM-M-AZUL`.

Abreviar ("AZ") parece más limpio y es una trampa: "Azul" y "Azufre" darían el mismo SKU, dos productos distintos compartirían código y el inventario dejaría de cuadrar **sin dar ningún error**. Se prefiere un código largo y sin ambigüedad, que además el operador puede reemplazar.

El código de barras se queda **vacío**. Un EAN lleva dígito de verificación y lo asigna el fabricante: inventarlo haría que la pistola del punto de venta leyera un producto que no es. Generar códigos internos válidos —el rango 200–299 está reservado para eso— es posible y queda fuera de alcance hasta que alguien lo pida.

### 8. Una combinación vendida se DESACTIVA, no se borra

`OrderItem.variant` no declara `onDelete`, así que la base aplica **Restrict**: borrar una variante que aparece en un pedido falla. Y debe fallar — el pedido guarda su `variantName`, pero la fila del pedido sigue apuntando a la variante.

Así que borrar un valor de opción hace dos cosas distintas según el caso: las combinaciones **nunca vendidas se borran**; las que **ya se vendieron se desactivan**. Salen del catálogo, dejan de publicarse y siguen existiendo para el historial.

La alternativa —impedir borrar el valor— dejaría al operador sin poder descontinuar un color por una razón que es puramente de base de datos.

### 9. Modal centrado y por pasos, no panel lateral

El panel lateral mide ~600 px. Con dos grupos de cuatro valores, la matriz son dieciséis filas de seis campos: no cabe, y lo que no cabe se llena mal.

Tres pasos, uno por clase de decisión:

1. **Qué es** — nombre, marca, categoría, descripción, fotos, activo y destacado.
2. **Cómo se vende** — ¿tiene variantes?, grupos y valores, y la matriz con SKU y precios.
3. **Cuánto hay** — el stock de cada combinación.

No es solo espacio: separar "qué es" de "cuánto hay" separa dos decisiones que hoy se toman a la vez y son de personas distintas —quien carga el catálogo y quien cuenta el inventario—. El paso 3 es además el único que toca el libro de inventario.

**Editar usa el MISMO modal y los mismos pasos.** Al principio se conservó el panel lateral para editar —"ahí se entra a cambiar una cosa"—, y era peor: dos interfaces para el mismo objeto, con la matriz apretada en 480 px justo cuando hay más que ver. Con las pestañas navegables el argumento desaparece: se abre, se salta a la pestaña que toque y se guarda. En edición el botón es siempre **Guardar**, no "Siguiente": nadie que entra a cambiar un precio quiere recorrer tres pasos para salir.

### 10. El stock inicial pasa a entrar por el motor

`upsertProduct` escribe hoy el movimiento y **materializa `stockActual` y `onlineUnits` a mano**, saltándose `receiveStock()`. Es la regla 1 del proyecto, y el importador sí la respeta.

Se corrige en este cambio porque el paso 3 es justamente el que asigna stock: dejar la ruta vieja al lado de la nueva daría dos formas de mover inventario, que es exactamente lo que la regla 1 existe para impedir.

## Risks / Trade-offs

- **Llenar 16 SKU a mano es inviable** → el panel ofrece precios y stock en bloque para toda la matriz, con ajuste por fila. Si no, el operador vuelve al texto libre y el modelo queda de adorno.
- **`variant.name` es un dato derivado guardado** → un solo escritor, y prueba que lo verifica.
- **Borrar un valor borra combinaciones con stock** → se avisa cuántas unidades se dejan de publicar antes de confirmar; los pedidos no se tocan.
- **Dos formas en el importador** → más superficie de prueba, a cambio de no obligar al cliente a rehacer una plantilla que ya está llenando.

## Migration Plan

1. Migración aditiva: tres tablas nuevas. **Sin backfill**: las variantes actuales se quedan sin filas de opción y siguen comportándose como hoy.
2. Se despliega como cualquier cambio; el catálogo existente no cambia de aspecto.
3. **Vuelta atrás**: revertir el código deja tres tablas vacías o con datos que nadie lee, y las variantes siguen teniendo su `name`. No hay pérdida.
