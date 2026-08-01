# Diseño — módulo de cupones

## Context

Motivación en `proposal.md`. Requisitos en `specs/`.

**Lo que existe y sirve:**

- `Coupon` con código único, tipo (porcentaje o fijo), valor, moneda, vigencia, máximos y contador de usos.
- `CouponRedemption` con pedido, cliente e importe descontado — **una por pedido**, ya con la unicidad puesta.
- `Order` con `discountTotal` y su relación al canje: **el lado del pedido ya está preparado**.
- `resolveCart()` resuelve precios y disponibilidad **en servidor**, y `createOrder()` los vuelve a resolver al crear. Nunca se confía en un precio del navegador — el cupón entra en esa misma disciplina.
- `createOrder()` es **idempotente por `checkoutToken`**: es lo que va a impedir que un doble clic gaste dos usos.
- El módulo de clientes acaba de dejar resuelto reconocer a un cliente por teléfono y correo, que es lo que necesitan "solo primera compra" y "máximo por cliente".

**Lo que falta en el modelo:** nombre interno y descripción, el tipo **producto gratis** con su variante, el **monto fijo en dos monedas a la vez**, el alcance por categorías o productos, y los dos interruptores de comportamiento.

## Goals / Non-Goals

**Goals**

- Que un cupón no pueda gastarse más veces de las que dice, ni siquiera con dos compradores simultáneos.
- Que el descuento que ve el comprador y el que cobra el operador sean el mismo número.
- Que el panel y el checkout coincidan siempre sobre si un cupón sirve.

**Non-Goals de diseño**

- **Reservar el cupón mientras el comprador llena el formulario.** Sería inventario, y un cupón no lo es.
- **Devolver usos.** Decisión del cliente, no un detalle de implementación.
- **Descuentos por escalones o combinables.** Un cupón, una regla.

## Decisions

### 1. El estado se calcula con una función, no se guarda

**Decisión:** una función única recibe el cupón y devuelve su estado. La usan el listado, los contadores de los filtros y la validación del checkout.

**Por qué:** un estado guardado hay que mantenerlo al día — al vencer, al agotarse, al pausar. Cualquier olvido deja el panel diciendo "Activo" sobre un cupón que el checkout rechaza, y el operador no tiene forma de saber cuál de los dos miente. Derivarlo hace imposible esa divergencia.

**Coste aceptado:** filtrar por estado no se puede delegar del todo a la base. Con el volumen de cupones de un negocio —decenas, no miles— es irrelevante.

### 2. El monto fijo se guarda en dos columnas, no en una con moneda

**Decisión:** un valor para pesos y otro para dólares, cada uno opcional. Un cupón "en ambas monedas" simplemente tiene los dos.

**Por qué:** el modelo actual tiene un valor y una moneda, y no puede representar "10.000 pesos o 5 dólares" — que es exactamente lo que pidió el cliente. La alternativa sería crear dos cupones con el mismo código, que la unicidad impide.

Y sobre todo: **no hay conversión**. Dos columnas dejan explícito que son dos importes decididos por el negocio, no uno derivado del otro. Es la misma regla que ya rige los precios del catálogo.

### 3. El descuento se calcula sobre el carrito que resuelve el servidor

**Decisión:** la función de descuento recibe el carrito **ya resuelto** por `resolveCart()` y devuelve el importe. No consulta precios por su cuenta.

**Por qué:** la función única de precios es la única fuente de verdad del proyecto. Si el módulo de cupones consultara precios por separado, bastaría una diferencia mínima —un precio online que cambió entre una consulta y otra— para que el descuento no cuadre con lo que el comprador vio. Y en un flujo donde el pago se acuerda por WhatsApp, ese descuadre lo descubre el operador cobrando.

### 4. El uso se consume dentro de la transacción del pedido, con un incremento condicional

**Decisión:** el contador se incrementa **con una escritura condicional** —solo si sigue por debajo del máximo— dentro de la misma transacción que crea el pedido. Si esa escritura no afecta ninguna fila, el cupón se agotó y toda la transacción se deshace.

**Por qué:** leer el contador, comprobar y luego escribir deja una ventana entre la comprobación y la escritura. Dos compradores que aplican el último uso a la vez leerían ambos "quedan 0 usados de 1" y ambos crearían su pedido. El incremento condicional traslada la decisión a la base, que sí sabe resolverla.

Es el mismo razonamiento del motor de inventario con el stock, y el mismo que se usó en la bandeja de salida: **cuando dos procesos compiten por un recurso finito, decide la base**.

### 5. El producto gratis es una línea más del pedido, con precio cero

**Decisión:** al canjearlo, la variante entra como una línea normal del pedido con precio cero y una marca de que es regalo del cupón.

**Por qué:** así **su stock se descuenta al confirmar como cualquier otro ítem**, por el motor de inventario, sin ningún camino especial. Un regalo que no descontara stock sería inventario que desaparece del almacén y no de la base — el fallo más caro que puede tener este sistema.

**Consecuencia:** si el producto regalado está agotado al confirmar, aplica el mismo flujo de stock insuficiente que cualquier otro ítem. Es lo que la historia de usuario pide.

### 6. La validación devuelve un motivo tipado, no un texto

**Decisión:** la función de validación devuelve un identificador de motivo; los textos exactos que ve el comprador viven en un solo mapa.

**Por qué:** los mensajes están fijados literalmente por la historia de usuario y hay siete. Repartirlos por el código garantiza que uno se desvíe. Con motivos tipados, además, las pruebas comprueban **qué falló** y no cómo está redactado — así corregir una tilde no rompe once pruebas.

### 7. El alcance se guarda como relaciones, no como una lista de identificadores

**Decisión:** tablas de unión hacia categorías y hacia productos.

**Por qué:** permite que la base garantice que un cupón no apunta a un producto borrado, y hace la consulta de elegibilidad un `join` en vez de una lista que hay que recorrer. Guardar identificadores en un campo de texto es cómodo hasta el primer producto que desaparece.

## Dónde vive cada cosa

```
src/modules/coupons/
  status.ts     estado derivado — usado por panel y checkout
  validate.ts   las siete comprobaciones, en orden, con motivo tipado
  discount.ts   cálculo sobre el carrito ya resuelto
  actions.ts    alta, edición y pausa, con requirePermission
  messages.ts   los textos exactos de la historia de usuario, en un solo sitio
src/app/admin/cupones/
tests/coupons.test.ts
```

**Migración de Prisma:** sí, y es la mayor de este change — el modelo de cupón crece con nombre, descripción, los dos valores por moneda, la variante de regalo, el alcance y los dos interruptores. Los cupones existentes (ninguno en producción) migran con valores por defecto.

**Modificado:** `createOrder()` incorpora el consumo del uso y el descuento en su transacción. Es el punto delicado del change: esa función ya es idempotente y crea el snapshot inmutable del pedido.

**Fidelidad de diseño:** listado con chips de estado y formulario en tarjetas, siguiendo el patrón del panel y mirando su equivalente en el prototipo aprobado.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un cupón se gasta más veces de las que dice.** Es dinero que sale y una campaña que se descontrola. | Incremento condicional dentro de la transacción del pedido, más la idempotencia por testigo de checkout que ya existe. Con prueba de concurrencia: dos creaciones simultáneas sobre un cupón de un solo uso → exactamente una gana. |
| **El descuento que ve el comprador no es el que cobra el operador.** | El cálculo usa el carrito resuelto en servidor y se revalida al crear el pedido. El importe entra en el snapshot y en el mensaje de WhatsApp. |
| **Tocar `createOrder()`**, que es el camino crítico de la venta y ya funciona. | El cupón se añade como un paso más de su transacción, sin reordenar lo existente. Las pruebas del pedido ya cubren la idempotencia y siguen en verde. |
| **El producto gratis descuadra el inventario** si entra por un camino especial. | Entra como línea normal con precio cero: su stock lo descuenta el motor al confirmar, como cualquier otro ítem. |
| **Siete mensajes literales que se desvían.** | Un solo mapa de textos; las pruebas comprueban el motivo tipado, no la redacción. |

## Migration Plan

1. Migrar el esquema y regenerar el cliente.
2. Estado derivado, validación y cálculo, **con sus pruebas antes que ninguna pantalla**.
3. Panel de administración: listado, alta, edición y pausa.
4. Integración en el checkout y en la creación del pedido.
5. Verificación de punta a punta: crear un cupón en el panel, aplicarlo como comprador, crear el pedido y comprobar el consumo del uso.

**Reversión:** quitar la entrada de navegación oculta el panel, y retirar el campo del checkout deja el flujo de venta exactamente como está hoy. La migración solo añade columnas con valores por defecto.

## Open Questions

- **Qué se considera "producto en oferta"** para el interruptor que los excluye: hoy la señal disponible es que exista precio online menor que el de tienda. Se toma esa; si el negocio entiende otra cosa por "oferta", es un ajuste local.
- **Longitud del listado antes de paginar.** La historia lo pide "si el listado crece"; con decenas de cupones no hace falta todavía.
