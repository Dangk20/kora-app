## Purpose

Permite gastar el saldo de Kora Cashback como descuento de una compra, con la garantía de que nadie gasta más de lo que tiene ni pierde lo que no gastó.

## ADDED Requirements

### Requirement: Solo el comprador con sesión puede gastar su saldo

Aplicar cashback SHALL exigir sesión de comprador. Un pedido de invitado NUNCA SHALL aplicar saldo, aunque el correo escrito corresponda a un cliente con cashback.

**Invariante:** sin sesión, la identidad del comprador es el correo que alguien escribió en un formulario. Permitir gastar sobre eso convierte el dato más fácil de conseguir que existe —el correo de una persona— en la llave de su dinero. Y el error sería invisible: la víctima solo lo nota cuando va a usar su saldo y no está.

#### Scenario: Invitado con el correo de un cliente con saldo

- **WHEN** alguien sin sesión completa el checkout escribiendo el correo de un cliente que tiene cashback
- **THEN** no se aplica ningún saldo y el pedido se crea normalmente

#### Scenario: Comprador con sesión

- **WHEN** un comprador con sesión aplica su saldo
- **THEN** el descuento se aplica sobre su propio cashback

### Requirement: El importe aplicable tiene tope y lo decide el servidor

El importe aplicado SHALL ser el menor entre lo que pide el comprador, su **saldo disponible en la moneda del pedido** y el **total del pedido**. Ningún importe que venga del navegador SHALL usarse como descuento.

**Invariante:** es la misma regla que rige los cupones y los precios: quien calcula es quien crea el pedido. Un descuento que llegara desde el navegador sería un campo que cualquiera puede editar, y en un cobro que se cierra por WhatsApp el descuadre lo descubre el operador cobrando.

El total NUNCA SHALL quedar negativo: el cashback no genera saldo a favor.

#### Scenario: Se pide más saldo del disponible

- **WHEN** el comprador intenta aplicar más cashback del que tiene
- **THEN** se rechaza con el motivo, sin aplicar nada

#### Scenario: El saldo supera el total del pedido

- **WHEN** el saldo disponible es mayor que el total
- **THEN** se aplica como mucho el total y el resto queda en el saldo

#### Scenario: Importe manipulado

- **WHEN** llega un descuento distinto del que corresponde
- **THEN** se ignora: el servidor recalcula el aplicable desde el libro

### Requirement: Las dos monedas siguen sin mezclarse

Un pedido SHALL gastar únicamente saldo de **su propia moneda**.

**Invariante:** no existe tasa de cambio en KORA y es deliberado. Convertir aquí crearía arbitraje: acumular en la moneda barata para gastar en la cara.

#### Scenario: Pedido en dólares con saldo en pesos

- **WHEN** un comprador con saldo solo en pesos intenta aplicarlo a un pedido en dólares
- **THEN** no hay saldo aplicable en esa moneda y se dice así

### Requirement: Cashback y cupón no se combinan

Un pedido NO SHALL llevar a la vez un cupón y saldo de cashback aplicado.

**Invariante:** es una regla del cliente, no una limitación técnica. La interfaz SHALL impedirlo antes de que el comprador elija, y el servidor SHALL rechazarlo aunque lleguen los dos: la interfaz orienta, el servidor decide.

#### Scenario: Cupón aplicado y luego cashback

- **WHEN** el comprador con un cupón aplicado intenta usar su cashback
- **THEN** se le explica que solo puede usar uno de los dos

#### Scenario: Llegan los dos al servidor

- **WHEN** una petición trae cupón y cashback a la vez
- **THEN** el pedido se rechaza sin crearse

### Requirement: El saldo se descuenta al crear el pedido

El cashback aplicado SHALL consumirse **dentro de la misma transacción que crea el pedido**, y el pedido SHALL guardar cuánto se pagó con saldo.

**Invariante:** descontarlo al confirmar dejaría que dos pedidos pendientes comprometieran el mismo saldo, y el segundo haría **fallar `confirmOrder()`** — el evento central del sistema, que ocurre con el operador al teléfono cerrando un cobro. Es el peor sitio posible para un error. Descontar al crear traslada el conflicto al checkout, donde el comprador todavía puede decidir y fallar solo cuesta un intento.

Es distinto del stock a propósito: reservar stock se lo quita a otros compradores; el cashback es del propio comprador y retenerlo no afecta a nadie más.

#### Scenario: Dos pedidos simultáneos con el mismo saldo

- **WHEN** dos pedidos del mismo comprador intentan aplicar a la vez un saldo que solo alcanza para uno
- **THEN** uno lo consigue y el otro es rechazado, y el saldo nunca queda negativo

#### Scenario: El pedido no se llega a crear

- **WHEN** la creación del pedido falla después de consumir el saldo
- **THEN** la transacción se deshace entera: ni pedido ni consumo

#### Scenario: Confirmación de un pedido con saldo aplicado

- **WHEN** el operador confirma un pedido que se pagó en parte con cashback
- **THEN** la confirmación no vuelve a tocar el saldo y no puede fallar por él

### Requirement: Si el pedido no prospera, el saldo vuelve a sus lotes originales

Un pedido que **expira o se cancela** SHALL devolver el cashback consumido **a los mismos lotes de los que salió**, conservando su fecha de vencimiento original.

**Invariante:** devolverlo como lote nuevo le daría 12 meses de vida a un saldo que estaba por caducar. Un comprador podría renovarlo indefinidamente creando y abandonando pedidos: cashback que el negocio ya había dado por vencido volvería a ser gastable para siempre.

La devolución SHALL ser **idempotente**: devolver dos veces el mismo pedido SHALL dejar el mismo saldo que devolverlo una vez.

#### Scenario: Pedido pendiente que expira

- **WHEN** expira un pedido que había aplicado cashback
- **THEN** el saldo vuelve al comprador y el lote conserva su vencimiento original

#### Scenario: Pedido cancelado desde el panel

- **WHEN** el operador cancela un pedido con cashback aplicado
- **THEN** el saldo vuelve igual que al expirar

#### Scenario: Devolución repetida

- **WHEN** el mismo pedido se procesa dos veces para devolver su saldo
- **THEN** el saldo sube una sola vez

#### Scenario: El lote ya venció mientras el pedido estaba pendiente

- **WHEN** el lote del que salió el saldo venció antes de la devolución
- **THEN** el importe vuelve al lote y queda vencido, sin ser gastable

### Requirement: La acumulación se calcula sobre lo pagado con dinero

El cashback que genera un pedido SHALL calcularse sobre su total **menos el cashback aplicado**.

**Invariante:** es la regla que el cliente precisó el 1 de agosto. Calcular sobre el total incluyendo la parte pagada con saldo crea un ciclo en el que el beneficio se recompensa a sí mismo.

#### Scenario: Compra pagada en parte con saldo

- **WHEN** se confirma un pedido de $100.000 en el que se aplicaron $20.000 de cashback
- **THEN** se acreditan $2.400 — el 3 % de $80.000

#### Scenario: Compra cubierta íntegramente con saldo

- **WHEN** el cashback cubre el total del pedido
- **THEN** no se acredita cashback nuevo, y se dice el motivo

### Requirement: El comprador y el operador ven el descuento

El resumen del checkout, el mensaje de WhatsApp y el detalle del pedido SHALL mostrar el cashback aplicado como una línea propia, distinta del descuento por cupón.

**Invariante:** el mensaje de WhatsApp es el documento con el que el operador cobra. Si el descuento no aparece ahí, cobra de más; y si aparece mezclado con un cupón, no puede explicarle al comprador de dónde sale la cifra.

#### Scenario: Pedido con cashback aplicado

- **WHEN** se crea un pedido con saldo aplicado
- **THEN** el mensaje de WhatsApp muestra el importe descontado como Kora Cashback y el total a pagar ya rebajado
