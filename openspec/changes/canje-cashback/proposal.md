# Canje de Kora Cashback en el checkout

**Semana del plan:** **S12**, la segunda mitad. El change `kora-cashback` dejó el saldo lleno y verificable; este lo gasta.

**HUs:** las de KoraPuntos (KPT_HU001–003) quedaron obsoletas y todavía no se han reescrito. La fuente de requisitos son las **reglas del cliente** (`business/kora-cashback-reglas-cliente.md` §2 y §4) y las specs del change `kora-cashback`.

## Why

**El saldo existe y no se puede gastar.** El comprador ve su cashback en su cuenta y la propia pantalla le dice que lo mencione por WhatsApp — una promesa a medias que el operador tiene que resolver a mano, fuera de la plataforma y sin registro. El mensaje comercial que el cliente aprobó dice *"úsalo como descuento en tu próxima compra"*, y hoy no hay tal descuento.

**Ahora se puede construir con seguridad.** Faltaba saber quién es el comprador: identificarlo por el correo escrito en el formulario habría permitido que cualquiera gaste el saldo ajeno. Con la cuenta construida, la identidad está demostrada.

## What Changes

- **Aplicar saldo en el checkout**, solo para el comprador con sesión y hasta el total del pedido.
- **Exclusión mutua con cupones** (regla del cliente): en una transacción se usa cashback **o** cupón, no ambos.
- **El pedido guarda cuánto se pagó con saldo**, que es lo que la acumulación ya esperaba para calcular su base — hoy vale cero por defecto.
- **Devolución del saldo si el pedido no prospera**: expirado o cancelado, el cashback vuelve **a sus lotes originales**, conservando su vencimiento.
- **El mensaje de WhatsApp muestra el descuento**, porque es el documento con el que el operador cobra.

## La decisión que hay que mirar de frente: cuándo se descuenta el saldo

El proyecto tiene una regla cerrada: **el stock solo se descuenta al confirmar, sin reserva.** Este change hace lo contrario con el cashback —lo descuenta **al crear el pedido** y lo devuelve si no prospera— y conviene explicar por qué no es una incoherencia.

**Por qué el stock no se reserva:** reservar unidades de un producto escaso se las quita a otros compradores. Un carrito abandonado bloquearía inventario que sí se podía vender.

**Por qué el cashback sí:** el saldo es **del propio comprador**. Retenerlo dos horas no se lo quita a nadie más.

**Y descontarlo al confirmar rompería algo que no puede romperse.** Dos pedidos pendientes podrían aplicar cada uno el mismo saldo; al confirmar el segundo, no habría con qué pagarlo y **`confirmOrder()` fallaría**. Esa función es el evento central del sistema y ocurre con el operador al teléfono cerrando un cobro: es el peor sitio posible para un error, y el operador no tendría forma de resolverlo.

Descontar al crear traslada el conflicto al checkout, donde el comprador todavía puede decidir, y donde fallar solo cuesta un intento.

**La devolución no puede crear saldo nuevo.** Vuelve a los lotes originales con su vencimiento intacto. Si generara un lote nuevo, un comprador podría renovar indefinidamente un cashback a punto de caducar creando y abandonando pedidos.

## Capabilities

### New Capabilities

- `cashback-redemption`: aplicar el saldo a una compra — cuánto se puede, con qué no se combina, cuándo se descuenta y cómo vuelve si el pedido no prospera.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado.

## Fuera de alcance

- **Canje en el POS.** El POS es S9 y no existe.
- **Recálculo por cambio de producto.** Sigue pendiente de una respuesta del cliente.
- **Canje parcial sugerido automáticamente.** El comprador decide cuánto aplica; proponerle un importe es una decisión comercial que nadie pidió.

## Bloqueos declarados

**Ninguno.** Las reglas están completas y la identidad del comprador está resuelta.

## Impact

**Archivos nuevos**
- `src/modules/cashback/redemption.ts` — cuánto se puede aplicar y por qué no
- `src/modules/cashback/refund.ts` — devolución a los lotes originales

**Archivos modificados**
- `prisma/schema.prisma` + migración — el pedido guarda el saldo aplicado
- `src/modules/orders/checkout-actions.ts` — aplicar y consumir dentro de la transacción del pedido
- `src/modules/orders/expire.ts` y `actions.ts` — devolver al expirar o cancelar
- `src/modules/orders/message.ts` — el descuento en el mensaje de WhatsApp
- `src/modules/events/handlers/order-confirmed-cashback.ts` — la base de cálculo resta lo pagado con saldo
- `src/app/(tienda)/checkout/` — la interfaz de aplicar saldo

**Reglas del proyecto que este change NO puede violar**
- **El saldo solo se mueve dentro de `cashback/ledger.ts`**, con movimiento y materialización en la misma transacción.
- **Las dos monedas no se suman ni se convierten**: un pedido en dólares solo puede gastar saldo en dólares.
- **Ningún importe viene del navegador**: el descuento lo calcula quien crea el pedido, como ya pasa con los cupones.
- **`confirmOrder()` no puede fallar por el cashback.** Al confirmar, el saldo ya está descontado.

**Riesgo principal**
Aplicar saldo que ya no existe, o devolver más del que se gastó. Ambas cosas se resuelven en la misma transacción del pedido, con el libro como única verdad, y se fijan con prueba — incluida la de dos pedidos simultáneos peleando por el mismo saldo.
