## Contexto

El hallazgo cambia el problema: las personas registradas **ya** tienen fila de cliente (la credencial cuelga del cliente desde `cuenta-comprador`) y **ya** salen en el listado. Lo que no existe es la forma de distinguirlas ni de contarlas, y la tarjeta que debía contarlas está fija en 0. No hay que crear filas nuevas ni tocar el registro: hay que leer lo que ya está.

## Decisiones

**La etiqueta se deriva, no se guarda.** Cliente = existe un pedido de la persona en `CONFIRMED_STATUSES` (`src/modules/customers/confirmed.ts`, la misma definición que usan Ventas, el perfil y las campañas). Es el patrón de `sales`: la venta se deriva del pedido, sin tabla propia. Una columna `esCliente` sería una segunda fuente de verdad que tendrían que mantener `confirmOrder()`, la cancelación, el futuro POS y cualquier ajuste manual; el primero que se olvide la desincroniza sin error. Derivada, "cambia de una vez" porque no hay nada que cambiar. Se descarta también la alternativa de escribirla en el manejador de `order.confirmed`: dependería del worker, y sin el worker en marcha la persona seguiría como No cliente con un pedido confirmado.

**Dónde vive.** `src/modules/customers/etiqueta.ts`: tipos, nombres visibles, el filtro (`todos | clientes | no_clientes`), su lectura tolerante desde la dirección y las condiciones de Prisma (`orders: { some | none: confirmedFilter }`). `queries.ts` las usa en `customerSummary()` y `listCustomers()`. La página solo pinta.

**Coste.** Por fila, la etiqueta sale de un `_count` filtrado de pedidos confirmados en la misma consulta del listado (subconsulta correlacionada, una por página, no una por cliente). Los conteos del resumen son `count()` con `some`/`none`, que Postgres resuelve con `EXISTS` sobre el índice de `orders.customerId`. Mismo orden de coste que el indicador "activos" que ya existe.

**"No cliente" es igual al segmento "sin_compras" de campañas** (`orders: { none: confirmedFilter }`). No se toca `campaigns/audience.ts`: ya usa la misma definición de pedido confirmado, y cambiarlo no aporta nada a este pedido.

**Cuenta / invitado** sale de `passwordHash IS NOT NULL`, igual que el perfil (`customer-sheet.tsx`) y el segmento `con_cuenta` de campañas. El hash se lee en el servidor y solo sale un booleano.

**Indicadores.** Tres tarjetas (Daniel, 11 oct): Total de registros, Clientes y No clientes. `customerSummary()` sigue calculando cuentas, nuevos y activos —el cero fijo de "con cuenta" se corrigió—, pero el panel no los muestra.

**Pantalla.** Mismo listado de `/admin/clientes` (patrón Productos/Inventario del prototipo `Kora.dc.html`, sección Clientes). La etiqueta va en una columna "Estado" con el estilo de los badges de estado de Pedidos: **Cliente** en el naranja de marca (`#FFE9DD` / `#FF5A1F`, el mismo de "Confirmado", que es justo el hecho que la produce) y **No cliente** en el gris neutro (`#f0ece6` / `#8a8f98`, el de "Pendiente"). Cuenta/Invitado va como segunda línea bajo el nombre, con el texto que ya usa el perfil. El filtro usa los chips de Cupones (`Todos · Clientes · No clientes`, el activo con `bg-kora-gradient`). Nada de verdes ni azules.

**Migración:** ninguna. **Eventos:** no emite ni consume `domain_events`.

## Riesgo asumido

- Una persona que compró y luego todos sus pedidos se cancelaron vuelve a No cliente. Es lo correcto según la definición (no hay venta), y es lo mismo que hacen Ventas y el indicador de activos.
