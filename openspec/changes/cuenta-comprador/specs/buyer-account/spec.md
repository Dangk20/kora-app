## Purpose

Lo que el comprador ve dentro de su cuenta: su Kora Cashback con el detalle que el cliente pidió, sus pedidos y sus datos.

## ADDED Requirements

### Requirement: El comprador ve su Kora Cashback completo

La cuenta SHALL mostrar, tal como el cliente lo definió: **saldo disponible**, **cashback pendiente**, **fecha de vencimiento** e **historial de ganado y utilizado**.

Los saldos SHALL mostrarse **por moneda** y NUNCA SHALL sumarse ni convertirse entre sí.

**Invariante:** los cuatro datos van juntos porque cada uno responde una pregunta distinta y sin los cuatro el comprador escribe por WhatsApp. Sin el pendiente cree que su compra no generó nada; sin el vencimiento no sabe que va a perderlo; sin el historial no puede discutir una cifra que no le cuadra. Y sumar pesos con dólares daría un número sin significado que además parecería correcto: no existe tasa de cambio en KORA y es deliberado.

#### Scenario: Comprador con saldo

- **WHEN** un comprador con cashback entra a su cuenta
- **THEN** ve su saldo disponible, lo pendiente, cuándo vence lo próximo y el historial

#### Scenario: Comprador con saldo en las dos monedas

- **WHEN** ha comprado en pesos y en dólares
- **THEN** ve dos saldos independientes, nunca un total combinado

#### Scenario: Comprador sin saldo

- **WHEN** todavía no ha generado cashback
- **THEN** se le explica cómo se gana, en lugar de un cero sin motivo

#### Scenario: Compra recién hecha, sin confirmar

- **WHEN** acaba de hacer un pedido que el operador aún no confirma
- **THEN** su cashback aparece como **pendiente** y se dice que estará disponible al confirmarse el pago

### Requirement: El comprador solo ve lo suyo

Toda consulta de la cuenta SHALL resolverse a partir de **la sesión**, nunca de un identificador que venga en la dirección o en el formulario.

**Invariante:** un número de pedido en la dirección que devuelva el pedido sin comprobar de quién es convierte la cuenta en un listado de todas las compras de la tienda, con nombres, teléfonos y direcciones. Es el fallo más común de un área privada y el más fácil de evitar: la pregunta no es "¿existe este pedido?" sino "¿es de quien está preguntando?".

#### Scenario: Pedido de otra persona

- **WHEN** un comprador pide un pedido que no es suyo
- **THEN** obtiene el mismo resultado que si no existiera

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión abre una dirección de la cuenta
- **THEN** se le lleva a la pantalla de acceso y no se filtra ningún dato

### Requirement: El comprador ve el historial de sus pedidos

La cuenta SHALL listar los pedidos del comprador con su número, fecha, total, estado y el cashback que generó cada uno; y SHALL permitir ver el detalle de cada uno.

Un pedido **pendiente de confirmar** SHALL mostrar que el pago se acuerda por WhatsApp y ofrecer el enlace para retomarlo mientras siga vigente.

**Invariante:** en KORA el pago ocurre fuera de la plataforma, así que el pedido pendiente no es un error: es el estado normal de una compra recién hecha. Si la cuenta no lo explica, el comprador cree que su compra falló y la vuelve a hacer.

#### Scenario: Pedido pendiente y vigente

- **WHEN** el comprador ve un pedido pendiente dentro de su vigencia
- **THEN** puede retomar la conversación de WhatsApp desde ahí

#### Scenario: Pedido expirado

- **WHEN** un pedido pendiente expiró sin confirmarse
- **THEN** se muestra como tal y no ofrece retomarlo

### Requirement: El comprador con sesión no vuelve a escribir sus datos

En el checkout, un comprador con sesión SHALL encontrar sus datos de contacto ya puestos y editables, y su pedido SHALL quedar atado **a su cliente por identidad**, no por coincidencia de correo o teléfono.

Editar los datos en un pedido NO SHALL cambiar los de la cuenta salvo que se pida explícitamente: el pedido conserva su propio snapshot.

**Invariante:** hoy el pedido reconoce al cliente por coincidencia de correo o teléfono. Con sesión eso sobra y además estorba: un dedazo en el teléfono crearía un cliente nuevo para alguien que ya está dentro, partiendo su historial y su cashback en dos. La coincidencia sigue siendo correcta para el comprador invitado, que es donde es el único dato que hay.

#### Scenario: Compra con sesión

- **WHEN** un comprador con sesión completa el checkout
- **THEN** el pedido queda atado a su cliente, aunque escriba un teléfono distinto del que tenía guardado

#### Scenario: Compra como invitado

- **WHEN** compra alguien sin sesión
- **THEN** el pedido sigue reconociendo o creando al cliente por correo o teléfono, como hasta ahora

### Requirement: El comprador puede corregir sus datos

La cuenta SHALL permitir actualizar nombre, teléfono y dirección, y cambiar la contraseña conociendo la actual.

Cambiar la contraseña SHALL **cerrar las demás sesiones** del comprador.

**Invariante:** cambiar la contraseña es lo que hace alguien que sospecha que otra persona entró. Si las sesiones abiertas siguieran valiendo, el gesto no serviría de nada — y detrás hay saldo gastable.

#### Scenario: Cambio de contraseña

- **WHEN** un comprador cambia su contraseña
- **THEN** sus otras sesiones dejan de valer y la actual sigue

#### Scenario: Contraseña actual incorrecta

- **WHEN** intenta cambiarla sin acertar la actual
- **THEN** no se cambia nada

### Requirement: La cuenta nunca escribe en el libro de cashback

Ninguna pantalla ni acción de la cuenta SHALL crear, modificar ni borrar movimientos de cashback: la cuenta **solo lee**.

**Invariante:** el saldo solo cambia dentro del módulo de cashback, con su movimiento y su materialización en la misma transacción. Una pantalla del comprador que pudiera escribir sería un segundo camino hacia el dinero, y el primero que dejaría de cuadrar.

#### Scenario: Consulta del saldo

- **WHEN** el comprador consulta su cashback
- **THEN** el libro queda exactamente igual que antes de la consulta
