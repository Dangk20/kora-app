## Why

**No mapea a ninguna HU escrita.** Ni PED_HU001 (datos de entrega del pedido) ni CLI_HU001–004 (módulo de clientes) contemplan que un comprador guarde varias direcciones. Es **alcance NUEVO**, pedido por Daniel el 1 sep 2026 durante las pruebas del flujo de compra, con Alkosto como referencia. Se declara como tal.

Hoy el cliente tiene **una** dirección, guardada en dos columnas sueltas (`customer.city`, `customer.address`) que se editan en "Mis datos" junto al nombre y el WhatsApp. Eso falla en tres sitios a la vez:

- **Una persona tiene más de una dirección** —casa, oficina, la casa de la mamá— y hoy tiene que reescribirla entera en cada compra.
- **El checkout no precarga nada de la entrega** aunque haya sesión: `BuyerDefaults` solo lleva nombre, correo y teléfono. El comprador con cuenta llena el formulario completo igual que un invitado, que es justo lo que la cuenta debía ahorrarle.
- **`customer.city`/`address` es una dirección sin estructura**: no tiene departamento, barrio ni ZIP, mientras el pedido sí los pide (`shipState`, `shipNeighborhood`, `shipZip`). Aunque quisiéramos precargar, no habría con qué llenar el formulario.

## What Changes

- **Nueva libreta de direcciones del comprador**: tabla propia, varias por cliente, una marcada como predeterminada.
- **Sección "Mis direcciones"** en la cuenta: lista de tarjetas con Editar y Eliminar, botón "Agregar una dirección" y distintivo de predeterminada — el patrón que Daniel señaló.
- **Ciudad y Dirección SALEN de "Mi información"**, que se queda con nombre, correo y WhatsApp. Dejar ahí una dirección suelta mientras existe la libreta serían dos respuestas distintas a "¿dónde vives?".
- **El checkout con sesión ofrece las direcciones guardadas**: se elige una y el formulario de entrega se llena solo; sigue existiendo "usar otra dirección" para escribir una nueva, con la opción de guardarla.
- **Los campos del pedido no cambian.** El pedido conserva su snapshot (`shipCountry`, `shipState`, `shipCity`, `shipAddress`, `shipAddress2`, `shipNeighborhood`, `shipZip`, `shipNotes`): una dirección editada o borrada después **no** puede reescribir un pedido ya despachado. La libreta llena el formulario; no sustituye al snapshot.
- **`customer.city` y `customer.address` dejan de ser editables por el comprador** y pasan a reflejar la dirección predeterminada, para que el módulo de clientes del panel siga funcionando sin cambios visibles para el operador.

## Capabilities

### New Capabilities
- `buyer-addresses`: la libreta de direcciones de un comprador — cuántas, cuál manda, quién puede verlas y tocarlas, y qué pasa con los pedidos ya hechos cuando una dirección cambia o se borra.

### Modified Capabilities
- `buyer-account`: "Mis datos" deja de contener la dirección, y la cuenta gana una sección propia de direcciones.

## Impact

- **Datos**: nueva tabla `customer_addresses` + migración versionada, con **backfill**: cada cliente que hoy tenga `city`/`address` estrena una dirección predeterminada con esos valores. Nadie pierde lo que ya tenía escrito.
- **Código**: nuevo `src/modules/customers/addresses.ts` (reglas) y sus acciones; sección nueva en `src/app/(tienda)/cuenta/`; `BuyerDefaults` del checkout crece con las direcciones; `cuenta-forms.tsx` pierde ciudad y dirección; `orders/customer-link.ts` mantiene sincronizada la predeterminada.
- **Panel**: el módulo de clientes sigue leyendo `customer.city`/`address` y no cambia de aspecto. Editar la dirección desde el panel sigue siendo posible y actualiza la predeterminada.
- **Riesgo que se acepta**: el comprador puede borrar una dirección usada por un pedido pasado. No pasa nada — el pedido lleva su propio snapshot— y esa es exactamente la razón por la que el snapshot existe. Queda fijado por prueba.

## Fuera de alcance

- Autocompletado de direcciones, mapas o validación contra un servicio postal. El operador confirma la entrega por WhatsApp; una dirección "verificada" que nadie verifica es peor que un texto libre.
- Direcciones de facturación separadas de las de envío. KORA no factura desde la plataforma.
- Libreta de direcciones en el POS o en el panel para el operador: el panel sigue con la dirección única del cliente.
- Cambiar el correo de la cuenta. Sigue sin editarse desde "Mi información" y no forma parte de esto.
