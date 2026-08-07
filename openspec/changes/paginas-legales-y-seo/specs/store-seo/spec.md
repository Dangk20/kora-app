## Purpose

La indexación de la tienda pública: qué puede rastrear un buscador, qué URLs del catálogo real le declaramos, y qué se ve cuando alguien comparte un enlace de KORA por WhatsApp, que es el canal comercial del negocio.

## ADDED Requirements

### Requirement: El sitio declara qué se puede rastrear y qué no

El sistema SHALL servir `/robots.txt` generado por la aplicación. El archivo SHALL permitir el rastreo de la tienda pública y SHALL prohibir explícitamente el rastreo de las zonas que no son catálogo: el panel de administración, el acceso del equipo, la cuenta del comprador, el carrito, el checkout, los enlaces de baja de suscripción y las rutas de servicio.

El archivo SHALL declarar la ubicación del sitemap.

#### Scenario: Un buscador consulta las reglas de rastreo

- **WHEN** un rastreador pide `/robots.txt`
- **THEN** recibe un documento que permite la tienda pública, prohíbe `/admin`, `/login`, `/cuenta`, `/carrito`, `/checkout`, `/suscripcion` y `/media`, y apunta al sitemap

#### Scenario: Una ruta privada nueva no queda expuesta por olvido

- **WHEN** se ejecuta la verificación automática de rastreo
- **THEN** falla si alguna de las rutas privadas declaradas queda fuera de las reglas de bloqueo

### Requirement: Staging nunca se indexa

En un entorno que no es producción, el sistema SHALL prohibir el rastreo por completo, con independencia de las reglas anteriores.

La protección SHALL existir en la propia aplicación y no depender únicamente de la cabecera que hoy añade el borde: staging está detrás de autenticación básica y de una cabecera `X-Robots-Tag` en el proxy, pero un cambio de configuración del borde no debe poder exponer un entorno de pruebas a Google sin que nada falle.

#### Scenario: Rastreador contra el entorno de pruebas

- **WHEN** se pide `/robots.txt` en un despliegue que se declara entorno de pruebas
- **THEN** la respuesta prohíbe el rastreo de todo el sitio

#### Scenario: Rastreador contra producción

- **WHEN** se pide `/robots.txt` en producción
- **THEN** la respuesta permite la tienda pública

#### Scenario: Desarrollo local nunca se declara indexable

- **WHEN** se pide `/robots.txt` en un entorno que no es un build de producción
- **THEN** la respuesta prohíbe el rastreo de todo el sitio

#### Scenario: Una sola definición de qué es producción

- **WHEN** se ejecuta la verificación automática del entorno
- **THEN** falla si el módulo de correo y el de rastreo no comparten el mismo predicado de entorno de producción

### Requirement: El sitemap se construye sobre el catálogo real

El sistema SHALL servir un sitemap generado desde la base de datos, no escrito a mano. SHALL incluir las páginas estáticas de la tienda (home, catálogo, las tres legales), las categorías con productos, y cada producto **publicado**.

El sitemap NO SHALL incluir productos despublicados, categorías vacías, ni ninguna URL privada. Cada entrada SHALL declarar su última modificación a partir del dato real del producto.

#### Scenario: Un producto se publica

- **WHEN** un operador publica un producto nuevo desde el panel y un rastreador pide el sitemap
- **THEN** la URL de ese producto aparece en el sitemap con su fecha de modificación

#### Scenario: Un producto se despublica

- **WHEN** un operador despublica un producto y un rastreador pide el sitemap
- **THEN** la URL de ese producto ya no aparece

#### Scenario: El sitemap no filtra rutas privadas

- **WHEN** se ejecuta la verificación automática del sitemap
- **THEN** falla si aparece cualquier URL bajo las rutas prohibidas en las reglas de rastreo

### Requirement: Un enlace compartido muestra el producto

Toda página pública de la tienda SHALL declarar metadata para compartir: título, descripción e imagen. En la ficha de producto, esos datos SHALL provenir del producto —su nombre, su descripción y su imagen principal— y no de valores genéricos de la tienda.

Este requisito no es cosmético: el negocio vende por WhatsApp, así que el enlace compartido es la primera impresión del producto y hoy no muestra nada.

#### Scenario: El operador comparte una ficha por WhatsApp

- **WHEN** se comparte la URL de un producto publicado que tiene imagen
- **THEN** la vista previa muestra el nombre del producto, su descripción y su imagen principal

#### Scenario: Producto sin imagen cargada

- **WHEN** se comparte la URL de un producto publicado que aún no tiene imágenes
- **THEN** la vista previa muestra el nombre y la descripción del producto con la imagen de marca por defecto, y no una tarjeta rota

#### Scenario: El título de la ficha identifica el producto

- **WHEN** un buscador indexa la ficha de un producto
- **THEN** el título de la página contiene el nombre del producto, y no solo el nombre de la tienda
