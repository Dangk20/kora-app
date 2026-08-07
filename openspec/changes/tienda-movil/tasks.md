## 1. Chrome móvil

- [x] 1.1 `src/modules/storefront/mobile/mobile-chrome.tsx`: header de una fila (logo · COP/USD · carrito con badge · Menú) con ocultar-al-bajar y umbral, y banda de búsqueda con gradiente de marca siempre visible.
- [x] 1.2 Barra inferior fija de 4 accesos (Inicio · Catálogo · Carrito · Cuenta) con icono relleno en el activo, badge del carrito y `env(safe-area-inset-bottom)`.
- [x] 1.3 Espaciador que reserva el hueco de la barra, para que el último elemento de cada página no quede tapado.
- [x] 1.4 `mobile-menu.tsx`: menú lateral de 320 px con categorías reales, cuenta, WhatsApp y enlaces legales; bloquea el desplazamiento de fondo y cierra con Escape o tocando fuera.
- [x] 1.5 `mobile-shell.tsx` para el estado compartido, y conexión en `(tienda)/layout.tsx` ocultando el header de escritorio por debajo de `lg`.
- [x] 1.6 Verificar a 390 px: chrome, menú abierto, y que las categorías se lean sobre su color.

## 2. Home

- [x] 2.1 Hero 4:5 con bullets de navegación, sobre la Vitrina real.
- [x] 2.2 Círculos de categoría con desplazamiento horizontal.
- [x] 2.3 Rejilla de 2 columnas para destacados y beneficios 2×2.
- [x] 2.4 Carruseles con **peek** de la card siguiente. ⚠️ El banner de Kora Cashback del diseño **no se añadió**: la portada la compone el operador desde Vitrina, y meter una sección fija saltándose ese control contradice cómo funciona el módulo. Si se quiere, es una sección más de Vitrina — decisión de producto.
- [x] 2.5 Footer compacto móvil.

## 3. Catálogo

- [ ] 3.1 Chips de categoría pegajosos bajo el chrome.
- [ ] 3.2 Bottom-sheets para Filtros y Ordenar.
- [ ] 3.3 Rejilla de 2 columnas y **"Cargar más"** — nunca paginación numérica.
- [ ] 3.4 Estado vacío: *"No encontramos productos con esos filtros."*

## 4. Ficha de producto

- [ ] 4.1 Galería a sangre con bullets.
- [ ] 4.2 Chips de variante y acordeones para descripción y especificaciones.
- [ ] 4.3 Barra sticky de compra que **reemplaza** a la de navegación al aparecer (nunca se superponen).
- [ ] 4.4 Sellos: solo lo que el negocio sostiene. Sin envío gratis, sin cuotas, sin pago contra entrega.

## 5. Carrito y checkout

- [ ] 5.1 Carrito como página completa, con el resumen accesible sin desplazarse hasta el fondo.
- [ ] 5.2 Checkout de un solo paso, campos de 48 px y resumen colapsable.
- [ ] 5.3 Confirmación con el enlace de WhatsApp y la vigencia de 2 h.

## 6. Cuenta

- [ ] 6.1 Entrar / crear cuenta en móvil.
- [ ] 6.2 Mis pedidos, detalle y saldo de Kora Cashback.

## 7. Estados

- [ ] 7.1 Skeleton de carga del catálogo y de la ficha.
- [ ] 7.2 Carrito vacío, producto agotado y error de red.

## 8. Cierre

- [ ] 8.1 Pruebas de la resolución del acceso activo de la barra inferior (incluida la ficha bajo "Catálogo").
- [ ] 8.2 Recorrido completo a 360, 390 y 430 px: catálogo → ficha → carrito → checkout.
- [ ] 8.3 🎯 Lighthouse móvil > 90.
- [ ] 8.4 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde, y actualizar `../bitacora-sprints-kora.md`.
