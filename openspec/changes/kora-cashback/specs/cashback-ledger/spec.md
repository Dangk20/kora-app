## Purpose

Lleva la cuenta del cashback de cada cliente como un libro contable por lotes, de modo que en cualquier momento se pueda responder cuánto tiene, de qué compras salió y cuándo vence cada parte.

## ADDED Requirements

### Requirement: El saldo materializado siempre cuadra con la suma del libro

Todo movimiento de cashback SHALL registrarse en el libro, y el saldo materializado del cliente SHALL actualizarse **en la misma transacción**. Ningún camino del sistema SHALL modificar el saldo sin escribir su movimiento.

**Invariante:** es la regla 1 del proyecto —la que gobierna el stock— aplicada a dinero. Un saldo que no cuadra con su libro es un pasivo que nadie puede auditar: no se sabe si sobra porque se acreditó de más o falta porque se consumió sin registrar, y sin los movimientos no hay forma de reconstruirlo.

#### Scenario: Acreditación

- **WHEN** se acredita cashback a un cliente
- **THEN** queda un movimiento en el libro y el saldo materializado refleja la suma, ambos en la misma transacción

#### Scenario: Verificación contable

- **WHEN** se ejecuta la comprobación del libro
- **THEN** informa si algún cliente tiene un saldo que no coincide con la suma de sus movimientos, **sin corregirlo**

#### Scenario: Fallo a mitad de una acreditación

- **WHEN** una acreditación falla después de escribir el movimiento y antes de materializar
- **THEN** la transacción se deshace entera: ni movimiento ni saldo

### Requirement: El cashback se acumula por lotes con su propio vencimiento

Cada acreditación SHALL crear un **lote** con su importe, su **moneda**, el **pedido que lo generó** y su **fecha de vencimiento a 12 meses** de la acreditación.

El saldo de un cliente NO SHALL ser un único número: SHALL ser la suma de sus lotes vigentes, **por moneda**.

**Invariante:** sin lotes no hay vencimiento posible. Con un saldo único no se puede responder qué parte cumple 12 meses el mes que viene, ni distinguir el saldo que caduca del que acaba de entrar. Es el mismo patrón contable del inventario, donde el saldo también es la consecuencia de sus movimientos y no un número que se edita.

#### Scenario: Varias compras del mismo cliente

- **WHEN** un cliente acumula cashback en compras distintas
- **THEN** cada una crea su lote, con su fecha de vencimiento propia

#### Scenario: Vínculo con el pedido de origen

- **WHEN** se consulta un lote
- **THEN** se puede saber de qué pedido salió — sin eso no hay forma de recalcular ni de auditar

### Requirement: Las dos monedas son dos bolsas separadas

El cashback SHALL llevarse **por moneda**. Los saldos en pesos y en dólares NUNCA SHALL sumarse ni convertirse entre sí.

**Invariante:** no existe tasa de cambio en KORA y es deliberado — cada divisa usa su propio precio cargado. Un saldo total que mezclara pesos y dólares sería un número sin significado que además **parecería correcto**. Y decidir una tasa aquí crearía arbitraje: acumular en la moneda barata para gastar en la cara.

#### Scenario: Cliente que compra en las dos monedas

- **WHEN** un cliente acumula cashback en pesos y en dólares
- **THEN** tiene dos saldos independientes, cada uno con sus lotes y vencimientos

#### Scenario: Consulta de saldo

- **WHEN** se consulta el saldo de un cliente
- **THEN** se obtiene por moneda, nunca un total agregado de las dos

### Requirement: El consumo va del lote más antiguo al más nuevo

Cuando se consume cashback, SHALL gastarse primero el lote **más próximo a vencer**.

**Invariante:** consumir el más nuevo primero dejaría el saldo antiguo caducando mientras el cliente cree que lo está usando — le haría perder dinero que sí tenía. Gastar lo que vence antes es lo que el cliente espera y lo único defendible.

#### Scenario: Consumo que cruza varios lotes

- **WHEN** se consume un importe mayor que el lote más antiguo
- **THEN** se agota ese lote y el resto sale del siguiente por antigüedad

#### Scenario: Consumo mayor que el saldo

- **WHEN** se intenta consumir más de lo disponible en esa moneda
- **THEN** la operación es rechazada y ningún lote se modifica

### Requirement: Los lotes vencen a los 12 meses, y el vencimiento queda registrado

Un lote que cumple 12 meses SHALL dejar de contar en el saldo disponible, mediante un **movimiento de vencimiento** en el libro — no borrando ni editando el lote.

**Invariante:** si el vencimiento se aplicara borrando, el libro dejaría de explicar el saldo y un cliente que reclama "yo tenía saldo" no tendría respuesta. Registrarlo como movimiento conserva la historia: se sabe cuánto venció, cuándo y de qué compra venía.

#### Scenario: Lote que cumple 12 meses

- **WHEN** un lote alcanza su fecha de vencimiento
- **THEN** deja de contar en el disponible y queda un movimiento que lo explica

#### Scenario: Lote parcialmente consumido que vence

- **WHEN** vence un lote del que ya se había gastado una parte
- **THEN** solo vence el remanente

#### Scenario: El historial sobrevive al vencimiento

- **WHEN** se consulta el historial de un cliente con lotes vencidos
- **THEN** se ven las acreditaciones, los consumos y los vencimientos

### Requirement: Distinción entre saldo disponible y pendiente

El sistema SHALL distinguir el cashback **disponible** —de pedidos ya confirmados, gastable— del **pendiente** —de pedidos creados que aún no se confirman.

**Invariante:** el cliente pidió mostrar ambos. "Pendiente" significa que la compra existe pero todavía no se confirmó su pago: es el cashback que el comprador va a tener en cuanto el operador confirme, y mostrarlo evita que crea que su compra no generó nada.

#### Scenario: Pedido creado sin confirmar

- **WHEN** un cliente tiene un pedido creado pendiente de confirmación
- **THEN** su cashback aparece como pendiente y **no** es gastable

#### Scenario: El pedido se confirma

- **WHEN** ese pedido se confirma
- **THEN** el cashback pasa a disponible

#### Scenario: El pedido expira

- **WHEN** un pedido pendiente expira sin confirmarse
- **THEN** su cashback pendiente desaparece, sin haber sido nunca disponible

### Requirement: La nomenclatura de puntos desaparece

El sistema NO SHALL contener el concepto "KoraPuntos" ni "puntos" en su modelo de datos, su código ni su interfaz.

**Invariante:** KoraPuntos era otro producto — un contador abstracto sin canje. Dejar sus restos convive dos modelos en la cabeza de quien lea el código, y en la interfaz le promete al operador algo que ya no existe.

#### Scenario: Búsqueda de restos

- **WHEN** se inspecciona el modelo de datos y la interfaz
- **THEN** no queda ninguna referencia a puntos como unidad de fidelización
