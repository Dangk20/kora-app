## Purpose

Qué puede contener una sección manual ("Yo elijo") de la Vitrina —productos sueltos o categorías enteras— y cómo se convierte eso en los productos que ve el visitante.

## ADDED Requirements

### Requirement: Una sección manual admite productos y categorías

El sistema SHALL permitir agregar a una sección en modo "Yo elijo" un producto o una categoría (padre o subcategoría), elegidos mediante selectores previos: tipo de elemento, categoría y, opcionalmente, subcategoría.

#### Scenario: Agregar un producto filtrando por categoría
- **WHEN** el operador elige "Producto", la categoría "Mujer" y la subcategoría "Short"
- **THEN** la lista de productos para elegir muestra solo productos de "Short"

#### Scenario: Agregar una categoría entera
- **WHEN** el operador elige "Categoría" y la categoría "Juguetes" sin subcategoría
- **THEN** la sección guarda la categoría como un elemento, no sus productos uno a uno

#### Scenario: Elemento repetido
- **WHEN** el operador agrega una categoría o un producto que ya está en la sección
- **THEN** el sistema lo rechaza con un mensaje y no duplica el elemento

### Requirement: Una categoría en la sección se resuelve a sus productos publicados

El sistema SHALL mostrar, por cada categoría de la sección, sus productos publicados en el orden del catálogo; una categoría padre SHALL incluir los de sus subcategorías; el aporte de cada categoría SHALL tener un tope fijo.

#### Scenario: Producto nuevo en la categoría
- **WHEN** se publica un producto nuevo en una categoría que está en la sección
- **THEN** aparece en la sección sin que nadie la edite

#### Scenario: Producto en dos elementos
- **WHEN** un producto está en la sección suelto y también por su categoría
- **THEN** se muestra una sola vez, en la primera posición en que aparece

#### Scenario: Categoría borrada
- **WHEN** se borra una categoría que estaba en una sección
- **THEN** el elemento desaparece de la sección y el resto se mantiene

### Requirement: El editor lista los elementos tal como se guardaron

El panel SHALL listar los elementos de la sección (productos y categorías) en su orden, con su tipo visible, y SHALL permitir reordenarlos y quitarlos.

#### Scenario: Categoría en la lista del editor
- **WHEN** la sección contiene la subcategoría "Short" de "Mujer"
- **THEN** el editor la muestra como "Mujer › Short" con la cantidad de productos que aporta
