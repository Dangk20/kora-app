## Why

**Módulo de clientes (§ clientes, CLI_HU001) — ajuste pedido por Daniel el 11 oct 2026.** No mapea a una semana nueva del plan: corrige y amplía la vista ya construida en el change `modulo-clientes`.

Pedido textual: *"Hoy no tenemos ni idea cuántas personas se han registrado en la web, porque en el módulo de clientes solo se guardan los que compran. Me gustaría que allí se guardaran también los usuarios que se registran, pero con la etiqueta **No cliente**, y los que sí han comprado cambien de una vez a la etiqueta **Cliente**."*

Lo que muestra el código hoy:

- **Registrarse SÍ crea la fila de cliente** (`registerBuyer()` en `src/modules/buyer/account.ts`: correo nuevo → `customer.create` con contraseña; correo de un invitado → se le pone contraseña a la fila existente). Y el listado **no filtra por pedidos**: `listCustomers()` trae todas las filas. Las personas registradas sin compra ya están en el listado.
- **Lo que falta es poder distinguirlas y contarlas.** Ninguna fila dice si la persona compró o no, el mensaje de lista vacía dice que los clientes "se crean solos con cada compra", y la tarjeta **"Clientes con cuenta" está fija en 0** (`conCuenta = 0` en `customerSummary()`): se escribió cuando la cuenta del comprador no existía y nunca se conectó cuando `cuenta-comprador` se construyó. Ese cero es exactamente el "no tenemos ni idea cuántos se han registrado".

## What Changes

- Cada persona del listado lleva una etiqueta **derivada de sus pedidos**: **Cliente** si tiene al menos un pedido en `CONFIRMED_STATUSES` (web o POS); **No cliente** si no tiene ninguno (registrado sin comprar, o con pedidos solo pendientes, cancelados o vencidos). Cambia a Cliente en el mismo instante en que se confirma su primer pedido, sin escribir nada más.
- El listado muestra además si la persona **tiene cuenta** en la tienda o es **invitada** (dato que ya existe: `passwordHash`).
- Filtro por etiqueta: **Todos / Clientes / No clientes**, resuelto en servidor y combinable con la búsqueda y el paginado.
- Indicadores arriba: **tres y nada más** (Daniel, 11 oct): **Total de registros**, **Clientes** y **No clientes**.
- Se ajusta el texto de lista vacía para que no diga que solo comprar crea clientes.

## Capabilities

### New Capabilities
Ninguna.

### Modified Capabilities
- `customer-directory` (change `modulo-clientes`, sin archivar): indicadores del resumen, columnas del listado y filtro por etiqueta.

## Impact

- **Datos**: sin migración. La etiqueta no se guarda: se deriva de los pedidos al consultar.
- **Código**: `src/modules/customers/` (definición de la etiqueta y consultas), `src/app/admin/clientes/page.tsx`.
- **Sin cambios** en el registro del comprador, en pedidos, en campañas (`campaigns/audience.ts` sigue usando su segmento "sin_compras", que es la misma definición), en el perfil del cliente, en cashback ni en permisos (`customers:view`).
- **Decisión del 18 jul que se ajusta**: CLI_HU001 dice "sin columna Tipo de cliente". Esa decisión era contra un *tipo asignado a mano* (VIP, mayorista…). La etiqueta de este change no es un tipo: no se edita, es un hecho que se lee de las ventas. Se documenta en la spec para que no se confundan.

## Fuera de alcance

- Guardar la etiqueta como columna o permitir cambiarla a mano.
- Más etiquetas (recurrente, inactivo, VIP…).
- Importación de la base de clientes existente (compromiso S10, HU aparte).
- Actualizar el espejo `../hus-clientes.md` y el tablero de Notion: lo hace Daniel con `hu-writer` si quiere reflejar el ajuste en la HU.
- El POS todavía no crea pedidos (`src/modules/pos/` está vacío): cuando exista, sus pedidos confirmados vuelven Cliente a la persona sin tocar este código, porque la etiqueta mira el estado del pedido y no su canal.
