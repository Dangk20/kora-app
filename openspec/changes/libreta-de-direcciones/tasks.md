## 1. Datos

- [x] 1.1 Modelo `CustomerAddress` en `prisma/schema.prisma` con los mismos campos que los `ship*` del pedido, más `label` e `isDefault`, e índice por `(customerId, isDefault)`.
- [x] 1.2 Migración versionada que crea la tabla **y hace el backfill** de `customer.city`/`address` como dirección predeterminada de quien ya la tuviera.
- [x] 1.3 `pnpm db:migrate` y comprobar el backfill contra la base local.

## 2. Reglas — `src/modules/customers/addresses.ts`

- [x] 2.1 Listar las direcciones de un cliente, con la predeterminada primero.
- [x] 2.2 Crear: la primera dirección queda predeterminada sola; marcar una nueva desmarca la anterior **en la misma transacción**.
- [x] 2.3 Editar y borrar, siempre con `customerId` **en el `where`**.
- [x] 2.4 Al borrar la predeterminada, otra la sustituye; si no queda ninguna, el cliente se queda sin ella.
- [x] 2.5 `sincronizarDireccionPrincipal()`: la ÚNICA función que escribe `customer.city`/`address`, desde la predeterminada.

## 3. La cuenta del comprador

- [x] 3.1 `direcciones-actions.ts` con `requireBuyer()` y revalidación de `/cuenta`.
- [x] 3.2 Sección "Mis direcciones": tarjetas con Editar, Eliminar y el distintivo de predeterminada, más "Agregar una dirección".
- [x] 3.3 Formulario de dirección por país (CO: departamento + barrio · US: estado + ZIP), reutilizando la lista de departamentos del checkout.
- [x] 3.4 Confirmación al eliminar, con el mismo patrón que el carrito: Cancelar dominante.
- [x] 3.5 Quitar Ciudad y Dirección de "Mi información" y de `actualizarDatos`.
- [x] 3.6 Añadir la sección al menú de la cuenta, en escritorio y en móvil.

## 4. El checkout

- [x] 4.1 `BuyerDefaults` crece con las direcciones del comprador.
- [x] 4.2 Selector de dirección con la predeterminada elegida de entrada y los campos precargados.
- [x] 4.3 "Usar otra dirección": campos libres y casilla para guardarla en la libreta.
- [x] 4.4 Elegir una dirección de otro país cambia el país del formulario y sus campos.

## 5. El panel

- [x] 5.1 Editar la dirección de un cliente desde el módulo de clientes actualiza su dirección predeterminada, sin crear direcciones nuevas por su cuenta.
- [x] 5.2 Comprobar que la ficha, el listado y el formulario del panel siguen viéndose igual.

## 6. Tests

- [x] 6.1 Una sola predeterminada por cliente en las tres transiciones (crear la primera, marcar otra, borrar la que manda).
- [x] 6.2 Editar o borrar una dirección NO cambia los datos de entrega de un pedido ya creado.
- [x] 6.3 Una dirección ajena no se lee, ni se edita, ni se borra — y la respuesta no delata si existe.
- [x] 6.4 El espejo `customer.city`/`address` sigue a la predeterminada, y lo escribe una sola función.
- [x] 6.5 "Mi información" ya no ofrece ciudad ni dirección.

## 7. Cierre

- [x] 7.1 Anotar en `../notas-tecnicas-privado.md` la deuda del espejo y su condición de salida, y el alcance nuevo fuera de cotización.
- [x] 7.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
