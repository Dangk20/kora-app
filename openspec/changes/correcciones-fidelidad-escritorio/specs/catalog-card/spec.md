## Purpose

La tarjeta de producto: qué información muestra, qué se puede hacer con ella, y por qué no ofrece añadir al carrito. Es la pieza que más se repite en la tienda —home, catálogo, relacionados— y la que la auditoría del 7 ago encontró contradiciendo una regla escrita del proyecto.

## ADDED Requirements

### Requirement: La tarjeta no permite añadir al carrito

La tarjeta de producto NO SHALL incluir un control para añadir al carrito ni para elegir variantes. La compra SHALL decidirse en la ficha del producto.

La razón es propia de este negocio y no una preferencia estética: **muchos productos tienen variantes**, y añadir desde la tarjeta obliga a elegir una por el comprador o a mandarlo a la ficha de todos modos. Lo primero genera carritos con la variante equivocada —que se descubren en la conversación de WhatsApp, cuando ya hay alguien atendiendo— y lo segundo es un botón que promete algo que no hace.

#### Scenario: Producto con variantes

- **WHEN** se muestra la tarjeta de un producto con más de una variante
- **THEN** no aparece ningún control de compra, y tocar la tarjeta lleva a su ficha

#### Scenario: Producto sin variantes

- **WHEN** se muestra la tarjeta de un producto con una sola variante
- **THEN** tampoco aparece control de compra: la tarjeta se comporta igual en los dos casos

#### Scenario: Fijado contra una regresión

- **WHEN** se ejecuta la verificación de la tarjeta
- **THEN** falla si la tarjeta vuelve a incluir un control de añadir al carrito

### Requirement: Toda la tarjeta es el enlace a la ficha

La tarjeta completa SHALL ser un único enlace a la ficha del producto, y SHALL exponer un nombre accesible que identifique el producto.

Sin el botón, el área táctil deja de competir con nada: la tarjeta entera pasa a ser el objetivo, que es lo que un pulgar necesita.

#### Scenario: Tocar cualquier zona

- **WHEN** el comprador toca la imagen, el nombre o el precio de la tarjeta
- **THEN** llega a la ficha de ese producto

#### Scenario: Lector de pantalla

- **WHEN** un lector de pantalla recorre el listado
- **THEN** cada tarjeta se anuncia como un solo enlace con el nombre del producto, no como un conjunto de elementos sueltos

### Requirement: La tarjeta muestra el precio y su origen, sin inventar nada

La tarjeta SHALL mostrar marca, nombre y precio resuelto por el módulo de precios. SHALL indicar cuándo el producto está agotado y cuándo su precio online es realmente menor que el de tienda.

NO SHALL mostrar valoraciones, favoritos, cuotas, envío gratis ni ningún sello que el negocio no sostenga.

#### Scenario: Precio especial online

- **WHEN** el precio online de la moneda activa es menor que el de tienda
- **THEN** la tarjeta lo señala y muestra el precio de tienda tachado en la misma moneda

#### Scenario: Sin ahorro real

- **WHEN** el precio online es igual o mayor que el de tienda
- **THEN** no hay tachado ni distintivo: comunicar un descuento que no existe es peor que no comunicarlo

#### Scenario: Producto sin cupo online

- **WHEN** el producto no tiene unidades disponibles para la web
- **THEN** la tarjeta lo indica como agotado y su precio se muestra atenuado

## ADDED Requirements

### Requirement: El panel nunca muestra identificadores internos al operador

Toda pantalla del panel que muestre el estado de un pedido SHALL usar su etiqueta en español y su distintivo de color, y NO SHALL imprimir el valor almacenado.

El valor de la base (`CONFIRMED`, `PREPARING`) es un detalle de implementación. Que se filtre a una pantalla es doblemente incorrecto: está en inglés en un producto en español, y expone el modelo de datos a quien solo necesita saber en qué punto va el pedido.

#### Scenario: Resumen del panel

- **WHEN** el operador abre el panel y ve la tabla de últimos pedidos
- **THEN** cada estado aparece con su etiqueta en español y su color, igual que en la pantalla de Pedidos

#### Scenario: Coherencia entre pantallas

- **WHEN** el mismo pedido se ve en el resumen y en el listado de pedidos
- **THEN** el estado se lee idéntico en las dos
