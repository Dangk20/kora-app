## Purpose

Los grupos de opciones de un producto (Talla, Color), sus valores (M, S / Azul, Rojo) y cómo se convierten en variantes vendibles. Define qué se le enseña al comprador cuando una combinación no existe o se quedó sin stock, y qué pasa con lo ya vendido cuando alguien borra un valor.

## ADDED Requirements

### Requirement: Un producto declara grupos de opciones con sus valores

El sistema SHALL permitir que un producto declare grupos de opciones, cada uno con sus valores, y SHALL tratar el conjunto como la estructura de la que salen sus variantes.

#### Scenario: Producto con un grupo
- **WHEN** un producto declara el grupo "Talla" con los valores "M" y "S"
- **THEN** tiene dos variantes posibles, una por valor

#### Scenario: Producto con dos grupos
- **WHEN** declara "Talla" (M, S) y "Color" (Azul, Rojo)
- **THEN** se crean las cuatro combinaciones, con el SKU propuesto y los precios del bloque
- **AND** cada una lleva su propio SKU, sus cuatro precios y su stock
- **AND** el operador puede quitar las que no venda

#### Scenario: Producto sin grupos
- **WHEN** no declara ningún grupo
- **THEN** conserva una única variante y en el panel no aparece la palabra "variante"

### Requirement: El nombre visible de la variante se deriva de sus valores

El sistema SHALL seguir guardando en la variante un nombre legible compuesto por sus valores, en el orden de los grupos.

#### Scenario: Nombre de una combinación
- **WHEN** una variante es Talla M y Color Azul
- **THEN** su nombre visible es "M · Azul"
- **AND** el carrito, el pedido, los correos y el mensaje de WhatsApp lo muestran sin cambio alguno respecto a hoy

#### Scenario: Renombrar un valor
- **WHEN** el operador corrige el valor "Azul" por "Azul rey"
- **THEN** el nombre visible de sus variantes pasa a "M · Azul rey"
- **AND** los pedidos ya creados conservan el nombre con el que se vendieron

### Requirement: El comprador elige por grupo, no de una lista suelta

El sistema SHALL presentar un selector por grupo en la ficha del producto, con el nombre del grupo visible.

#### Scenario: Ficha con dos grupos
- **WHEN** el comprador abre un producto con Talla y Color
- **THEN** ve dos selectores separados, cada uno rotulado con el nombre de su grupo

#### Scenario: Combinación sin existencias
- **WHEN** con la talla M elegida, el color Rojo no tiene ninguna combinación con cupo online
- **THEN** Rojo se muestra tachado y no se puede elegir

#### Scenario: Combinación que el operador quitó
- **WHEN** el operador quitó la combinación S+Rojo porque no la vende
- **THEN** se comporta igual que una sin existencias: no se puede elegir

#### Scenario: Ficha de un producto sin grupos
- **WHEN** el producto no tiene grupos
- **THEN** no se muestra ningún selector, como hoy

### Requirement: Borrar un valor no toca lo ya vendido

El sistema NO SHALL modificar ni borrar los datos de un pedido existente cuando se elimine un valor de opción o una combinación.

#### Scenario: Se descontinúa un color
- **WHEN** el operador borra el valor "Rojo"
- **THEN** desaparecen sus combinaciones del catálogo
- **AND** los pedidos que vendieron esas combinaciones conservan su snapshot intacto

#### Scenario: Combinación con stock
- **WHEN** el valor que se va a borrar tiene combinaciones con existencias
- **THEN** el sistema avisa cuántas unidades se dejan de publicar antes de confirmar

#### Scenario: Combinación que ya se vendió
- **WHEN** una combinación del valor que se borra aparece en algún pedido
- **THEN** esa combinación se **desactiva** en vez de borrarse
- **AND** desaparece del catálogo pero sigue existiendo para el pedido que la vendió
- **AND** la operación no falla

### Requirement: El importador acepta las dos formas

El sistema SHALL seguir aceptando la columna `Variante` de texto libre, que crea una variante sin grupos, y SHALL aceptar además columnas de opción y valor que crean la estructura.

#### Scenario: Plantilla que ya tiene el cliente
- **WHEN** se importa un archivo con la columna `Variante` escrita como "Talla M / Rojo"
- **THEN** se crea la variante con ese nombre y sin grupos, exactamente como hoy

#### Scenario: Plantilla con opciones
- **WHEN** el archivo trae columnas de opción y valor
- **THEN** se crean los grupos, sus valores y la combinación correspondiente

#### Scenario: Archivo mezclado
- **WHEN** el mismo producto trae filas con la columna vieja y filas con las nuevas
- **THEN** la importación se rechaza entera, señalando el producto y la fila
- **AND** no se escribe nada, como con cualquier otro error de validación

### Requirement: El stock sigue siendo del motor de inventario

El sistema NO SHALL escribir `stockActual` ni `onlineUnits` fuera de `src/modules/inventory/engine.ts` al crear o modificar combinaciones.

#### Scenario: Combinación nueva con stock inicial
- **WHEN** se crea una combinación con existencias iniciales
- **THEN** entran por el motor de inventario, con su movimiento en `stock_movements`

### Requirement: El SKU de cada combinación se propone, no se teclea

El sistema SHALL proponer un SKU para cada combinación a partir de un código base del producto y los valores que la componen, y SHALL permitir cambiarlo fila por fila.

#### Scenario: Propuesta desde el código base
- **WHEN** el producto tiene el código base "CAM" y la combinación es Talla M con Color Azul
- **THEN** se propone "CAM-M-AZUL"
- **AND** el operador puede reemplazarlo por el código del proveedor

#### Scenario: Valores que empiezan igual
- **WHEN** dos valores del mismo grupo son "Azul" y "Azufre"
- **THEN** los SKU propuestos los distinguen por completo
- **AND** ninguno se abrevia hasta hacerlos coincidir

#### Scenario: SKU repetido
- **WHEN** una combinación queda con un SKU que ya usa otra variante del catálogo
- **THEN** se señala la fila antes de guardar
- **AND** no se intenta la escritura

### Requirement: El código de barras no se inventa

El sistema NO SHALL generar códigos de barras. Es un dato del fabricante y un valor inventado haría que la pistola del punto de venta leyera un producto que no es.

#### Scenario: Combinación recién creada
- **WHEN** se genera una combinación
- **THEN** su código de barras queda vacío
- **AND** puede pegarse por fila cuando el proveedor lo entregue

### Requirement: Encontrar un producto por cualquiera de sus códigos

El sistema SHALL encontrar un producto buscando por nombre, por SKU **o por código de barras**.

#### Scenario: Alguien escanea en el panel
- **WHEN** se busca por un código de barras cargado en una variante
- **THEN** aparece su producto

### Requirement: Crear un producto es un recorrido por pasos, no un formulario

El sistema SHALL presentar la creación de un producto en pasos, cada uno con una sola clase de decisión, y SHALL permitir volver atrás sin perder lo escrito.

#### Scenario: Los pasos
- **WHEN** el operador crea un producto
- **THEN** recorre: (1) qué es el producto, (2) sus opciones y combinaciones, (3) el stock de cada una
- **AND** en cada paso ve solo los campos de ese paso

#### Scenario: Volver atrás
- **WHEN** vuelve a un paso anterior
- **THEN** encuentra lo que ya había escrito

#### Scenario: Producto sin variantes
- **WHEN** declara que el producto no tiene variantes
- **THEN** el paso de opciones se reduce a un SKU y sus precios
- **AND** el paso de stock pide una sola cantidad

#### Scenario: Espacio para la matriz
- **WHEN** un producto tiene dos grupos con varios valores
- **THEN** la matriz se presenta en una superficie que la admite completa, no en un panel lateral

### Requirement: El stock inicial entra por el motor de inventario

El sistema NO SHALL escribir `stockActual` ni `onlineUnits` fuera de `src/modules/inventory/engine.ts` al crear un producto o una combinación.

#### Scenario: Stock inicial de una combinación
- **WHEN** se asigna stock inicial a una combinación recién creada
- **THEN** entra por `receiveStock()`, con su movimiento en `stock_movements` y la materialización dentro de la misma transacción

#### Scenario: Sin stock inicial
- **WHEN** una combinación se crea con cero unidades
- **THEN** no se registra ningún movimiento
