## Purpose

Cómo se editan las categorías y subcategorías desde el panel y qué conteo de productos se muestra de cada una.

## ADDED Requirements

### Requirement: Categorías y subcategorías se editan desde un control visible

El panel SHALL ofrecer un botón de editar en cada categoría y en cada subcategoría que permita cambiar el nombre y el ícono; en la categoría padre SHALL permitir además el color.

#### Scenario: Renombrar una subcategoría
- **WHEN** el operador edita la subcategoría "Blusa ligera" y la llama "Blusas"
- **THEN** la tienda y el panel muestran "Blusas" y sus productos siguen en ella

#### Scenario: Cambiar el ícono de una subcategoría
- **WHEN** el operador elige otro ícono para una subcategoría
- **THEN** se guarda en esa subcategoría sin cambiar el de su categoría padre

### Requirement: El conteo de una categoría padre incluye sus subcategorías

El panel SHALL mostrar en cada categoría padre la suma de sus productos directos y los de sus subcategorías.

#### Scenario: Productos solo en subcategorías
- **WHEN** "Hombre" no tiene productos directos y sus subcategorías suman 67
- **THEN** la tarjeta de "Hombre" dice "67 productos"
