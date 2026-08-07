## 1. Dashboard: el estado deja de salir en crudo

- [x] 1.1 En `src/app/admin/page.tsx`, sustituir `{o.status}` por el badge con `STATUS_LABEL` + `STATUS_STYLE`, importados de `@/modules/orders/status` — los mismos que usa Pedidos, no una copia.
- [x] 1.2 Prueba que falle si alguna pantalla del panel vuelve a imprimir el valor almacenado.

## 2. La tarjeta pierde el botón

- [x] 2.1 En `src/modules/storefront/product-card.tsx`, quitar el botón y envolver toda la tarjeta en un único `<Link>` a la ficha, con nombre accesible.
- [x] 2.2 Comprobar que `AddToCartButton` sigue usándose en la ficha y no queda huérfano.
- [x] 2.3 Actualizar `CLAUDE.md` si hiciera falta para que la regla y el código digan lo mismo.
- [x] 2.4 Pruebas: la tarjeta no expone control de compra ni con variantes ni sin ellas; es un solo enlace.

## 3. La ficha recupera las garantías y el orden de los botones

- [x] 3.1 Extraer `GUARANTEES` de `home-layout.tsx` a un módulo compartido de `storefront/` y consumirlo desde el home.
- [x] 3.2 Añadir el bloque de tres garantías bajo los botones de compra de la ficha.
- [x] 3.3 Invertir el orden: *Agregar al carrito* y luego *Comprar ahora*, como el prototipo.
- [x] 3.4 Prueba de que las garantías publicadas no incluyen ninguna promesa que el negocio no sostiene.

## 4. Cierre

- [x] 4.1 Verificar a 1440 px las tres pantallas tocadas.
- [x] 4.2 Marcar en `docs/auditoria-fidelidad-escritorio.md` qué queda corregido y qué sigue abierto.
- [x] 4.3 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde, y actualizar `../bitacora-sprints-kora.md`.
