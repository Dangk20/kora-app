## Purpose

Convierte un código escrito por el comprador en un descuento calculado y registrado, de forma que la promoción llegue resuelta al operador en vez de negociarse por chat. Traza CUP_HU004.

## ADDED Requirements

### Requirement: El descuento se calcula y se valida SIEMPRE en el servidor

Ningún descuento SHALL depender de datos que venga del navegador. El servidor SHALL resolver el cupón, comprobar su validez y calcular el importe a partir del carrito que él mismo resuelve.

**Invariante:** es la misma regla que ya rige los precios del carrito — nunca se confía en un precio que venga del cliente. Un descuento calculado en el navegador es un descuento que cualquiera puede editar antes de enviarlo, y aquí lo que se edita es dinero.

#### Scenario: Importe manipulado desde el navegador

- **WHEN** llega una petición de creación de pedido con un descuento distinto del que corresponde al cupón
- **THEN** el servidor ignora el valor recibido y usa el que él calcula

#### Scenario: Cupón inexistente enviado directamente

- **WHEN** se envía un código que no existe saltándose la interfaz
- **THEN** el pedido se crea sin descuento o se rechaza, nunca con un descuento inventado

### Requirement: Las validaciones tienen un orden fijo y un mensaje propio

Al aplicar un cupón SHALL comprobarse, **en este orden**, deteniéndose en la primera que falle:

| # | Comprobación | Mensaje |
|---|---|---|
| 1 | No existe o está pausado | "Cupón no válido." |
| 2 | Fuera de vigencia | "Este cupón no está vigente." |
| 3 | Agotado | "Este cupón ya alcanzó su límite de usos." |
| 4 | Moneda no aplicable | "Este cupón no aplica para compras en \<moneda\>." |
| 5 | Sin ítems elegibles | "Este cupón no aplica a los productos de tu carrito." |
| 6 | Solo primera compra y el cliente ya compró | "Este cupón es solo para tu primera compra." |
| 7 | Máximo por cliente alcanzado | "Ya usaste este cupón el máximo de veces permitido." |

**Invariante:** el orden importa porque el mensaje es lo único que el comprador ve. Comprobar primero el carrito y después la vigencia le diría "no aplica a tus productos" sobre un cupón que en realidad venció — y se iría a cambiar el carrito para nada.

#### Scenario: Cupón pausado y además vencido

- **WHEN** se aplica un cupón que está pausado y cuya fecha además pasó
- **THEN** el mensaje es "Cupón no válido.", el de la primera comprobación que falla

#### Scenario: Cupón de una moneda en un pedido de la otra

- **WHEN** se aplica un cupón de monto fijo solo en pesos a un pedido en dólares
- **THEN** se rechaza indicando que no aplica para compras en esa moneda

#### Scenario: Carrito sin productos del alcance

- **WHEN** el cupón aplica a una categoría y el carrito no tiene nada de ella
- **THEN** se rechaza indicando que no aplica a los productos del carrito

#### Scenario: Cliente reincidente en un cupón de primera compra

- **WHEN** se aplica un cupón de primera compra y el contacto del formulario ya tiene pedidos confirmados
- **THEN** se rechaza con el mensaje correspondiente

### Requirement: Cálculo del descuento por tipo

| Tipo | Cómo se calcula |
|---|---|
| **Porcentaje** | Sobre el subtotal de los ítems elegibles, en la moneda del pedido |
| **Monto fijo** | Se resta el valor de la moneda del pedido sobre el subtotal elegible |
| **Producto gratis** | La variante configurada se agrega al pedido con precio cero, marcada como regalo del cupón |

El total del pedido NUNCA SHALL quedar negativo: el descuento se limita al subtotal elegible y no genera saldo a favor.

Cuando el cupón NO aplique a productos en oferta, los ítems con precio rebajado SHALL quedar fuera del subtotal elegible.

**Invariante:** el descuento se calcula sobre lo que devuelve la función única de precios, no sobre precios recalculados por el módulo. Dos fuentes de precio es cómo aparecen los descuentos que no cuadran con lo que el comprador vio.

#### Scenario: Descuento mayor que el carrito

- **WHEN** un cupón de monto fijo supera el subtotal elegible
- **THEN** el descuento se limita al subtotal y el total queda en cero, no negativo

#### Scenario: Carrito con productos en oferta y el cupón no los admite

- **WHEN** el cupón no aplica a productos en oferta y parte del carrito está rebajada
- **THEN** el descuento se calcula solo sobre los ítems que no están en oferta

#### Scenario: Producto gratis

- **WHEN** se aplica un cupón de producto gratis
- **THEN** esa variante se agrega al pedido con precio cero, identificada como regalo del cupón

#### Scenario: Un solo cupón por pedido

- **WHEN** ya hay un cupón aplicado y se aplica otro
- **THEN** el segundo sustituye al primero, sin acumularse

### Requirement: El uso se consume al CREAR el pedido, y no se libera

El uso SHALL consumirse en la **misma transacción** que crea el pedido, incrementando el contador total y el del cliente.

Un pedido que después expire o se cancele **NO SHALL liberar el uso**. Confirmar un pedido **NO SHALL volver a contarlo**.

**Invariante:** es una decisión del cliente del 19 jul, y es deliberadamente distinta del stock —que solo se descuenta al confirmar—. Un cupón es un cupo de campaña, no inventario: si los pedidos abandonados devolvieran usos, una campaña de cien cupones podría repartir muchos más.

Consumirlo dentro de la transacción del pedido es lo que impide que un doble clic gaste dos usos: esa transacción ya es idempotente por su testigo de checkout.

#### Scenario: Creación del pedido con cupón

- **WHEN** se crea un pedido con un cupón aplicado
- **THEN** el uso queda consumido en la misma transacción, y si la creación falla no se consume

#### Scenario: Doble clic en crear pedido

- **WHEN** se envía dos veces la creación del mismo pedido
- **THEN** se crea un solo pedido y se consume **un solo** uso

#### Scenario: El pedido expira

- **WHEN** un pedido creado con cupón expira sin confirmarse
- **THEN** el uso permanece consumido

#### Scenario: Confirmación posterior

- **WHEN** se confirma un pedido creado con cupón
- **THEN** el contador de usos no cambia: ya se contó al crearlo

### Requirement: El cupón queda en el snapshot inmutable del pedido

El pedido SHALL guardar el código del cupón y el importe efectivamente descontado. Cambios posteriores en el cupón —pausa, edición de valor, alcance— NO SHALL alterar pedidos ya creados.

#### Scenario: El cupón cambia después de crear el pedido

- **WHEN** se edita el valor de un cupón que ya tiene pedidos
- **THEN** esos pedidos conservan el descuento con el que se crearon

#### Scenario: El mensaje al operador incluye el descuento

- **WHEN** se genera el mensaje de WhatsApp de un pedido con cupón
- **THEN** incluye el código y el importe descontado, para que el operador cobre lo correcto

### Requirement: El cupón se revalida al crear el pedido

Entre aplicar el cupón y crear el pedido puede cambiar todo. Al crear, SHALL revalidarse por completo; si ya no es válido, el pedido **NO SHALL crearse** y SHALL informarse el motivo.

**Invariante:** sin revalidar, un cupón con un solo uso podría gastarse dos veces por dos compradores que lo aplicaron a la vez. La validación al aplicar es para la experiencia; la que decide es la de la transacción.

#### Scenario: El cupón se agota entre aplicar y crear

- **WHEN** el último uso lo consume otro comprador mientras este llenaba el formulario
- **THEN** la creación falla con el mensaje de límite alcanzado y el pedido no se crea

#### Scenario: El cupón se pausa entre aplicar y crear

- **WHEN** el cupón se pausa desde el panel mientras el comprador llena el formulario
- **THEN** la creación falla con "Cupón no válido." y el pedido no se crea

### Requirement: Modificar el carrito recalcula o retira el cupón

Con un cupón aplicado, cambiar el carrito SHALL recalcular el descuento. Si el cupón deja de ser aplicable, SHALL retirarse avisando.

#### Scenario: Se quita del carrito el último producto elegible

- **WHEN** el comprador elimina el único producto al que aplicaba el cupón
- **THEN** el cupón se retira con aviso y el total vuelve a su valor sin descuento

#### Scenario: Se añaden más productos elegibles

- **WHEN** el comprador añade otro producto dentro del alcance de un cupón porcentual
- **THEN** el descuento se recalcula sobre el nuevo subtotal elegible
