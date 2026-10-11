## 1. Diagnóstico

- [x] 1.1 Confirmar en el código y en la base local que registrarse crea la fila de cliente y que el listado no filtra por pedidos; localizar por qué no se puede saber cuántos se registraron.
  - Evidencia: `registerBuyer()` crea/actualiza la fila `customers` con `passwordHash`; `listCustomers()` no filtra por pedidos. Base local (11 oct): 12 personas — 5 con cuenta sin compra, 1 con cuenta y compra, 5 invitados con compra, 1 sin cuenta ni compra. Las 5 registradas sin compra ya salían en el listado, sin nada que las distinguiera, y `customerSummary()` devolvía `conCuenta = 0` fijo.

## 2. Dominio — `src/modules/customers/`

- [x] 2.1 `etiqueta.ts`: tipos, nombres visibles, filtro y su lectura tolerante, condiciones de Prisma sobre `confirmedFilter`.
- [x] 2.2 `customerSummary()`: suma `clientes` y `noClientes`; `conCuenta` deja de ser 0 fijo.
- [x] 2.3 `listCustomers()`: filtro por etiqueta combinable con búsqueda; cada fila trae `etiqueta` y `tieneCuenta`.

## 3. Panel `/admin/clientes`

- [x] 3.1 Seis indicadores, chips de filtro, columna Estado y Cuenta/Invitado bajo el nombre, con colores de marca.
- [x] 3.2 Enlaces de paginado, Ver y Editar conservan búsqueda y filtro; texto de lista vacía corregido.

## 4. Pruebas

- [x] 4.1 Integración: registrado sin compra → No cliente; con pedido pendiente → No cliente; al confirmar → Cliente; invitado que compró → Cliente; venta POS → Cliente; conteos (Clientes + No clientes = total, con cuenta); filtro con búsqueda.
  - Evidencia: `tests/clientes-registrados.test.ts`, 15 pruebas en verde.

## 5. Verificación

- [x] 5.1 `pnpm spec validate clientes-registrados`, `pnpm typecheck`, `pnpm lint`, `pnpm build` y `pnpm test` en verde.
  - Evidencia (11 oct 2026): change válido; typecheck sin errores; lint 0 errores (1 aviso previo en `login/recuperar/actions.ts`, ajeno); build OK; `pnpm test` 69 archivos / 979 pruebas en verde.
