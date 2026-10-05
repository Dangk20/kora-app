## 1. Base

- [x] 1.1 `src/modules/i18n/`: idioma activo (cookie > origen > es), diccionarios es/en tipados, proveedor cliente, acción para cambiar idioma.
- [x] 1.2 `<html lang>` según idioma; selector ES | EN junto al de moneda (escritorio y móvil).

## 2. Datos

- [x] 2.1 `nameEn`/`descriptionEn` en productos y `nameEn` en categorías + migración.
- [x] 2.2 Consultas de la tienda eligen el texto por idioma con caída al español; el buscador busca en ambos.
- [x] 2.3 Panel: campos en inglés en producto y categoría.

## 3. Interfaz

- [x] 3.1 Layout, header, navegación, pie, versión móvil.
- [x] 3.2 Portada y secciones; catálogo; ficha.
- [x] 3.3 Carrito, checkout, puente de WhatsApp, cuenta del comprador.

## 4. Contenido

- [x] 4.1 Traducción inicial de productos y categorías, cargada por SKU.

## 5. Verificación

- [x] 5.1 Pruebas: precedencia del idioma y caída al español; typecheck/lint.
- [x] 5.2 Recorrido en el navegador en ambos idiomas, escritorio y móvil.
