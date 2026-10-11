## MODIFIED Requirements

### Requirement: Resumen de la base en cuatro indicadores

La vista SHALL mostrar estos tres indicadores, y solo estos, calculados en tiempo real:

| Indicador | Qué cuenta |
|---|---|
| **Total de registros** | Total histórico de filas de cliente: registradas, compradoras invitadas y creadas a mano |
| **Clientes** | Personas con al menos un pedido confirmado, en cualquier fecha y canal |
| **No clientes** | Personas sin ningún pedido confirmado |

Cuando no haya datos, cada indicador SHALL mostrar **cero**, sin error.

**Invariante:** "Cliente" significa **compró y esa compra se confirmó**. Un pedido pendiente, cancelado o vencido no vuelve Cliente a nadie — si lo hiciera, el indicador contaría intenciones en vez de ventas, y el operador tomaría decisiones de remarketing sobre gente que nunca compró. **Clientes + No clientes = Total de registros**, siempre.

#### Scenario: Base con actividad

- **WHEN** se abre la vista con clientes registrados y pedidos confirmados recientes
- **THEN** los indicadores muestran valores coherentes con el listado

#### Scenario: Base vacía

- **WHEN** se abre la vista sin ningún cliente
- **THEN** todos los indicadores muestran cero y el listado informa que no hay personas, sin error

#### Scenario: Un cliente con pedido pendiente

- **WHEN** un cliente tiene un pedido creado pero **sin confirmar** en los últimos 30 días, y ningún confirmado
- **THEN** cuenta en "Total de registros" y en "No clientes", pero **NO** cuenta como Cliente

#### Scenario: Un cliente con pedido cancelado

- **WHEN** el único pedido reciente de un cliente fue cancelado
- **THEN** no cuenta como Cliente

#### Scenario: Alguien se registra en la tienda

- **WHEN** una persona crea su cuenta sin comprar
- **THEN** "Total de registros" y "No clientes" suben en uno, y "Clientes" no cambia

### Requirement: Listado con la información operativa del cliente

El listado SHALL mostrar por cada persona: nombre completo con avatar de iniciales, su **etiqueta** (Cliente / No cliente), si **tiene cuenta** en la tienda o es **invitada**, número de WhatsApp, correo electrónico, país, los **días de la semana en que más pedidos confirmados** ha hecho, y las acciones **Ver** y **Editar**.

El listado SHALL incluir a **todas** las personas con fila de cliente, hayan comprado o no.

El orden SHALL ser por fecha de creación descendente.

NO SHALL existir acción de eliminar. NO SHALL existir un "tipo de cliente" asignable a mano: la etiqueta es un hecho derivado de las ventas, no un campo editable.

**Invariante:** que no se pueda eliminar no es una carencia: el histórico es permanente porque alimenta el remarketing y la fidelización. Un cliente borrado se lleva consigo las compras que explican su saldo.

#### Scenario: Cliente sin correo

- **WHEN** un cliente no tiene correo registrado
- **THEN** su fila lo indica sin romper el listado, y el cliente sigue siendo válido

#### Scenario: Días de mayor pedido

- **WHEN** un cliente tiene pedidos confirmados concentrados en ciertos días de la semana
- **THEN** el listado resalta esos días, contando **solo** pedidos confirmados

#### Scenario: Cliente sin compras

- **WHEN** un cliente no tiene ningún pedido confirmado
- **THEN** aparece en el listado con la etiqueta No cliente y sin ningún día resaltado

#### Scenario: Persona registrada que nunca compró

- **WHEN** alguien se registró en la tienda y no tiene pedidos
- **THEN** aparece en el listado como No cliente, con cuenta

#### Scenario: No hay forma de eliminar

- **WHEN** se revisan las acciones disponibles sobre un cliente
- **THEN** solo existen Ver y Editar

## ADDED Requirements

### Requirement: Etiqueta Cliente / No cliente derivada de los pedidos

Cada persona SHALL tener exactamente una etiqueta:

- **Cliente**: tiene al menos un pedido en estado confirmado o posterior (`CONFIRMED_STATUSES`: confirmado, en preparación, enviado, entregado), de cualquier canal (web o POS).
- **No cliente**: no tiene ninguno.

La etiqueta SHALL calcularse a partir de los pedidos en cada consulta, usando la definición única de pedido confirmado del módulo. NO SHALL guardarse como dato aparte ni poder editarse.

**Invariante:** una sola fuente de verdad. Si la etiqueta se guardara, una confirmación que no la actualiza —o una cancelación posterior, un ajuste manual— dejaría a la persona con la etiqueta equivocada sin ningún error. Derivada, cambia a Cliente en el mismo instante en que el pedido queda confirmado.

#### Scenario: Registrado sin compra

- **WHEN** una persona tiene cuenta y ningún pedido
- **THEN** su etiqueta es No cliente

#### Scenario: Solo pedidos pendientes, cancelados o vencidos

- **WHEN** todos los pedidos de una persona están pendientes o cancelados
- **THEN** su etiqueta es No cliente

#### Scenario: Se confirma su primer pedido

- **WHEN** el operador confirma el primer pedido de una persona No cliente
- **THEN** en la siguiente consulta su etiqueta es Cliente, sin ningún paso adicional

#### Scenario: Comprador invitado

- **WHEN** alguien compró sin cuenta y su pedido se confirmó
- **THEN** su etiqueta es Cliente y figura como invitado

#### Scenario: Venta en el punto de venta

- **WHEN** una persona tiene un pedido confirmado del canal POS
- **THEN** su etiqueta es Cliente

### Requirement: Filtro del listado por etiqueta

La vista SHALL ofrecer el filtro **Todos / Clientes / No clientes**, resuelto en servidor y combinable con la búsqueda y el paginado. El filtro elegido SHALL viajar en la dirección, de modo que paginar, buscar o abrir un panel lateral lo conserve.

#### Scenario: Ver solo No clientes

- **WHEN** el operador elige "No clientes"
- **THEN** el listado y su paginado muestran solo personas sin pedidos confirmados

#### Scenario: Filtro y búsqueda juntos

- **WHEN** hay un filtro de etiqueta activo y se busca por nombre
- **THEN** el resultado cumple las dos condiciones

#### Scenario: Valor desconocido en la dirección

- **WHEN** la dirección trae un filtro que no existe
- **THEN** se muestra "Todos", sin error
