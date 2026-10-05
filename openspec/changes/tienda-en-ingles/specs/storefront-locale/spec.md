## Purpose

Qué idioma ve el visitante de la tienda, cómo se decide y cómo lo cambia, y qué partes se traducen.

## ADDED Requirements

### Requirement: El idioma sigue al mismo origen que la moneda

El sistema SHALL mostrar la tienda en inglés a un visitante cuyo origen es `exterior` y en español cuando es `colombia` o `desconocido`, usando la misma detección de origen que la moneda.

#### Scenario: Visitante desde EE. UU.
- **WHEN** entra un visitante cuyo origen es `exterior` y no ha elegido idioma
- **THEN** ve la tienda en inglés y los precios en USD

#### Scenario: Origen desconocido
- **WHEN** no se puede determinar el origen
- **THEN** la tienda se muestra en español

### Requirement: La elección manual de idioma prevalece

El sistema SHALL ofrecer un selector de idioma y SHALL recordar la elección por encima de la detección.

#### Scenario: Colombiano en el exterior elige español
- **WHEN** un visitante con origen `exterior` elige "ES"
- **THEN** ve la tienda en español en esta y en las siguientes visitas

### Requirement: El contenido sin traducción se muestra en español

El sistema SHALL mostrar el título, la descripción o el nombre de categoría en español cuando no tengan versión en inglés, nunca un texto vacío.

#### Scenario: Producto sin traducir
- **WHEN** la tienda está en inglés y un producto no tiene título en inglés
- **THEN** se muestra su título en español

### Requirement: Lo que queda fuera se mantiene en español

El sistema SHALL mantener en español el panel, los correos, el comprobante, el mensaje de WhatsApp y las páginas legales.

#### Scenario: Pedido desde la tienda en inglés
- **WHEN** un visitante crea un pedido con la tienda en inglés
- **THEN** el mensaje de WhatsApp que recibe el equipo va en español
