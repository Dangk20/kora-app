## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño:

- **El pedido ya guarda su propia dirección** (`shipCountry`, `shipState`, `shipCity`, `shipAddress`, `shipAddress2`, `shipNeighborhood`, `shipZip`, `shipNotes`), con el comentario del esquema explicándolo: *"si el cliente cambia de dirección después, el pedido despachado conserva la suya"*. La libreta llena un formulario; no participa del pedido una vez creado.
- **El formulario de entrega ya distingue país**: Colombia pide departamento y barrio, EE.UU. pide estado y ZIP. Una dirección guardada tiene que poder representar los dos, o no servirá para precargar nada.
- **El módulo de clientes del panel lee `customer.city` y `customer.address`** en la ficha, el formulario y el listado. No está en alcance rehacerlo.
- **La cuenta del comprador no usa Auth.js**: su sesión es propia (`kora_buyer`) y la regla del módulo es que el identificador del comprador va **en el `where`**, nunca en una comprobación posterior.

## Goals / Non-Goals

**Goals:**
- Que un comprador con cuenta no vuelva a escribir su dirección.
- Una sola respuesta a "¿dónde vive esta persona?" desde el lado del comprador.
- Que el panel no se entere: el operador sigue viendo una dirección por cliente.

**Non-Goals:**
- Rehacer el módulo de clientes del panel.
- Validar o normalizar direcciones contra ningún servicio.
- Tocar los datos de entrega de pedidos existentes.

## Decisions

### 1. Tabla propia con los MISMOS campos que el pedido

`customer_addresses` replica uno a uno los campos `ship*` del pedido —país, departamento/estado, ciudad, dirección, complemento, barrio, ZIP, notas— más una etiqueta ("Casa", "Oficina") y la marca de predeterminada.

Que los nombres coincidan no es comodidad: elegir una dirección es **copiar sus campos al formulario**, y el formulario escribe los `ship*` del pedido. Con nombres distintos habría un traductor en medio, que es justo donde se pierde un barrio o un ZIP sin que nada falle.

*Alternativa descartada:* guardar la dirección como un texto único. Es lo que hay hoy (`customer.address`) y es la razón por la que no se puede precargar: no tiene piezas.

### 2. La predeterminada se garantiza en la escritura, no en la lectura

Una sola dirección `isDefault` por cliente, y las tres transiciones —crear la primera, marcar otra, borrar la que manda— ocurren **dentro de una transacción**: se desmarca la anterior y se marca la nueva juntas.

Calcularlo al leer ("la más reciente si ninguna está marcada") parece más simple y es peor: dos pantallas distintas pueden calcularlo distinto, y el checkout acabaría precargando una dirección que la cuenta muestra como no predeterminada.

### 3. `customer.city`/`address` pasan a ser un ESPEJO de la predeterminada

No se borran del esquema: el panel las lee en tres sitios y sacarlas convertiría este cambio en una reforma del módulo de clientes. Pasan a escribirse **solo** desde la libreta —al cambiar la predeterminada, al editarla, al borrarla— y desde el panel, que actualiza la predeterminada en vez de escribirlas sueltas.

Es duplicación, y se acepta a conciencia con una condición: **una sola función la escribe** (`sincronizarDireccionPrincipal`), para que no haya dos sitios que la mantengan y se separen. Queda anotado como deuda en `../notas-tecnicas-privado.md`: el día que el panel lea la libreta, estas dos columnas se van.

### 4. El comprador puede borrar una dirección que un pedido usó

Sin `onDelete: Restrict` ni copia defensiva: el pedido **ya tiene** su snapshot. Impedir el borrado obligaría a explicarle al comprador que no puede quitar una dirección donde ya no vive, por una razón que es puramente nuestra.

La relación es `customerId` → cliente, y el pedido **no guarda `addressId`**: si lo guardara, tendríamos una referencia que puede apuntar a datos distintos de los que se despacharon, que es la clase de dato que engaña.

### 5. Dónde vive la lógica

`src/modules/customers/addresses.ts` — reglas puras y consultas (crear, editar, borrar, marcar predeterminada, sincronizar el espejo). Va en `customers/` y no en `buyer/` porque una dirección es del **cliente**, y el panel también la toca; `buyer/` es el mecanismo de sesión.

Las acciones del comprador viven en `src/app/(tienda)/cuenta/direcciones-actions.ts`, con `requireBuyer()` y el `customerId` **en el `where`** de cada consulta.

### 6. El checkout: un selector, y "otra dirección" siempre disponible

`BuyerDefaults` crece con la lista de direcciones. Con al menos una, el checkout muestra tarjetas seleccionables y arranca en la predeterminada, llenando los campos. Siempre hay una opción "Usar otra dirección" que vacía y libera los campos, con una casilla para guardarla.

Elegir una dirección de otro país **cambia el país del formulario**, porque los campos no son los mismos. Sin eso, elegir una dirección de EE.UU. dejaría un formulario colombiano pidiendo barrio.

### 7. Sin eventos ni cambios en el pedido

No se emite nada a `domain_events` y `createOrder()` no cambia: sigue recibiendo los campos del formulario. La libreta es anterior al pedido, no parte de él.

## Risks / Trade-offs

- **Dos sitios con la dirección (`customer.*` y la libreta)** → mitigado con una única función que escribe el espejo, y declarado como deuda con su condición de salida.
- **Backfill de una dirección sin estructura**: lo que hoy es `address` es texto libre; al convertirlo en dirección solo se pueden llenar ciudad y dirección, sin departamento ni barrio → se acepta: es exactamente la información que había. El comprador la completa al editarla, y el checkout seguirá pidiendo lo que falte.
- **Un comprador con muchas direcciones alarga el checkout** → se muestran como tarjetas compactas; sin paginación, que a esta escala sobra.
- **Cambiar el país desde el selector reescribe campos ya escritos** → solo ocurre al elegir una dirección explícitamente, que es una acción deliberada.

## Migration Plan

1. Migración Prisma versionada: crea `customer_addresses` y hace el **backfill** en el mismo archivo — un `INSERT ... SELECT` de los clientes con `city` o `address` no vacíos, marcados como predeterminados.
2. `pnpm db:migrate` en desarrollo; en el servidor lo aplica el contenedor de migraciones del despliegue.
3. **Vuelta atrás**: la migración es aditiva. Revertir el código deja la tabla en pie sin que nadie la lea, y `customer.city`/`address` siguen teniendo el valor que tenían. No hay pérdida.
