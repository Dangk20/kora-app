# Módulo de cupones

**Semana del plan:** **S7 — Carrito + cupones**. El carrito se cerró el 19 jul; los cupones son la mitad que quedó pendiente.

**HUs:** **CUP_HU001** (listado y filtros), **CUP_HU002** (crear), **CUP_HU003** (editar y pausar), **CUP_HU004** (canje en el checkout). Espejo en `../hus-cupones.md` y tablero Notion. Al cerrar, sincronizar ambos lados.

## Why

**S7 figura como parcial desde el 19 de julio por esto.** El carrito, el checkout y el pedido están construidos y funcionando; el campo de cupón es lo único que falta para cerrar la semana.

Y es lo que el negocio va a pedir primero. KORA no tiene pasarela de pago: el precio se acuerda por WhatsApp. Sin cupones, **cualquier promoción se negocia en el chat** — el operador descuenta a mano, sin registro, sin límite de usos y sin forma de saber después cuánto costó la campaña. Un cupón convierte esa conversación en una regla que el sistema aplica y cuenta.

Se hace ahora, antes que el POS o el dashboard, por dos razones:

1. **Kora Cashback se calcula sobre el valor final pagado, después de descuentos y cupones.** Es la regla que entregó el cliente. Construir el cashback antes que los cupones significaría construirlo sobre una base que va a cambiar.
2. **El módulo de clientes acaba de existir**, y las reglas "solo primera compra" y "máximo por cliente" se apoyan justamente en poder reconocer a un cliente — que es lo que ese módulo dejó resuelto.

## What Changes

- **Panel de cupones**: listado con filtros por estado, creación, edición y pausa en un clic.
- **Campo de canje en el checkout**, con validación en servidor y el descuento calculado antes de enviar el pedido a WhatsApp.
- **BREAKING — el modelo de cupón crece bastante.** El actual guarda código, tipo, valor y poco más; las historias piden nombre interno, descripción, **producto gratis**, **monto fijo en dos monedas a la vez**, alcance por categorías o productos, y dos reglas de comportamiento. Requiere migración.
- **`createOrder()` consume el uso del cupón** en la misma transacción que crea el pedido.

## Las tres decisiones del cliente que moldean el módulo

Están fechadas el 19 jul y no son negociables desde el código:

**El uso se consume al CREAR el pedido, no al confirmarlo.** Un pedido que después expira o se cancela **no libera el uso**. Es distinto de cómo funciona el stock —que solo se descuenta al confirmar— y la asimetría es deliberada: un cupón es un cupo de campaña, no inventario.

**"Producto gratis" sustituye a "días gratis"** del patrón original. Al canjearlo, el producto entra al pedido con precio cero y su stock se descuenta al confirmar como cualquier otro ítem.

**El monto fijo puede aplicar a COP, a USD o a ambas.** No hay conversión: si el cupón es de una sola divisa y el pedido está en la otra, se rechaza. Es coherente con la regla del sistema — las monedas no se convierten nunca.

## Capabilities

### New Capabilities

- `coupon-management`: definir cupones y controlarlos — su estado derivado, la inmutabilidad del código y la pausa como única forma de sacarlos de circulación.
- `coupon-redemption`: aplicar un cupón a un pedido — qué se valida, en qué orden, cómo se calcula el descuento y cuándo se consume el uso.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado.

## Fuera de alcance

- **Cupones en el POS.** La historia lo excluye y el POS todavía no existe (S9).
- **Combinar varios cupones en un pedido.** Uno por pedido, dice la historia.
- **Interacción con Kora Cashback.** Ya está definida por el cliente —al usar cashback no se pueden combinar cupones— pero se implementa cuando exista el cashback, que sigue bloqueado por dos preguntas.
- **Generación masiva de códigos** y **cupones automáticos por campaña** (módulo EML, S13).
- **Métricas de conversión por cupón** (dashboard, S11).
- **Duplicar cupón** e **historial de cambios**, ambos excluidos por CUP_HU003.

## Bloqueos declarados

**Ninguno.** Las decisiones del cliente están tomadas desde el 19 jul y las dependencias —catálogo, carrito, checkout, módulo de clientes— están construidas.

## Impact

**Archivos nuevos**
- `src/modules/coupons/` — estado derivado, validación, cálculo del descuento y acciones
- `src/app/admin/cupones/` — listado y formulario
- Campo de canje en el checkout de la tienda
- `tests/coupons.test.ts`

**Archivos modificados**
- `prisma/schema.prisma` + migración — el modelo de cupón crece
- `src/modules/orders/checkout-actions.ts` — consumo del uso dentro de la transacción del pedido
- `prisma/seed.ts` — permisos del módulo
- Navegación del panel

**Reglas del proyecto que este change NO puede violar**
- **La validación vive en el servidor.** El navegador no puede forzar un descuento: quien calcula es quien crea el pedido.
- **El descuento entra al snapshot inmutable del pedido.** Pausar o editar un cupón después no altera pedidos ya creados.
- **El producto gratis descuenta stock por el motor de inventario**, como cualquier ítem — nunca por fuera.
- **Ningún precio se calcula fuera de `resolvePrice()`**: el cupón descuenta sobre lo que esa función devuelve, no recalcula precios.

**Riesgo principal**
Un cupón es dinero que sale. Los dos errores caros son **consumir un uso dos veces** (doble clic en un checkout con cupo limitado) y **calcular el descuento en el navegador** (cualquiera lo manipula). Los dos se cierran en el mismo sitio: la transacción que crea el pedido, que ya es idempotente por `checkoutToken`.
