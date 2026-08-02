## Purpose

Deja consultar qué se vendió, cuándo y por qué canal, con cifras que el operador pueda usar para cerrar su mes sin que ninguna mezcle monedas.

## ADDED Requirements

### Requirement: Los totales NUNCA mezclan monedas

Ninguna cifra del módulo de ventas ni del dashboard SHALL sumar importes de monedas distintas, ni convertir entre ellas. Todo total SHALL presentarse **por moneda**, con su símbolo.

**Invariante:** es la regla que gobierna todo el proyecto —no existe tasa de cambio en KORA y es deliberado, cada divisa usa su propio precio cargado— y aquí es donde más duele romperla, porque el resultado **parece correcto**. Un pedido de USD 40 sumado a pesos da un número plausible que nadie va a cuestionar, y el operador cerrará su mes con él.

Es exactamente el defecto que este change corrige: hoy las tarjetas del dashboard suman las dos monedas y lo imprimen todo como pesos.

#### Scenario: Ventas en las dos monedas en el mismo periodo

- **WHEN** en un periodo hay ventas en pesos y en dólares
- **THEN** se muestran dos totales independientes, cada uno con su moneda, y **no** un total combinado

#### Scenario: Tarjetas del dashboard

- **WHEN** el operador ve las cifras de ventas del dashboard
- **THEN** corresponden a **una sola moneda**, identificada en pantalla, y ningún importe de la otra entra en ellas

#### Scenario: Periodo sin ventas en una moneda

- **WHEN** en el periodo no hubo ventas en una de las monedas
- **THEN** esa moneda muestra cero, y no se oculta ni se fusiona con la otra

### Requirement: "Venta" tiene UNA sola definición en todo el sistema

Una venta SHALL ser un pedido que **llegó a confirmarse**. Un pedido pendiente NO SHALL contar como venta; uno cancelado o expirado tampoco.

Esta definición SHALL ser **la misma** que ya usan el módulo de clientes y el dashboard, sin que este módulo escriba su propio filtro.

**Invariante:** si cada pantalla definiera lo suyo, bastaría con que una olvidara excluir los cancelados para que el total de ventas y el del dashboard **se contradijeran** — y ninguna de las dos cifras parecería equivocada. El error solo se descubre cuando alguien las compara, que suele ser delante del cliente.

Un pedido que avanzó después de confirmarse —en preparación, enviado, entregado— **sigue siendo una venta**.

#### Scenario: Pedido pendiente de confirmar

- **WHEN** existe un pedido creado que el operador aún no confirma
- **THEN** no aparece en las ventas ni suma a ningún total

#### Scenario: Pedido cancelado tras confirmarse

- **WHEN** un pedido confirmado se cancela
- **THEN** deja de contar como venta

#### Scenario: Pedido entregado

- **WHEN** un pedido confirmado avanzó hasta entregado
- **THEN** sigue contando como venta, una sola vez

#### Scenario: Coincidencia entre pantallas

- **WHEN** se compara el total de ventas del periodo con la cifra del dashboard para el mismo periodo y moneda
- **THEN** coinciden

### Requirement: La fecha de una venta es la de su confirmación

Una venta SHALL fecharse por el momento en que **se confirmó**, no por cuándo se creó el pedido.

**Invariante:** el pedido se arma cuando el comprador quiere y se confirma cuando el operador cobra. Un pedido creado el 31 y confirmado el 1 es una venta del mes nuevo: fecharlo por su creación metería dinero en un mes en el que no entró, y el cierre contable dejaría de cuadrar con la caja.

#### Scenario: Pedido que cruza el cierre de mes

- **WHEN** un pedido se crea el último día de un mes y se confirma el primero del siguiente
- **THEN** cuenta en el mes de la confirmación

### Requirement: Los días y los meses son los de Colombia, no los del servidor

Toda agrupación por fecha —el día de la gráfica, "ventas de hoy", "ventas del mes", el cierre de un periodo— SHALL calcularse en el **huso horario del negocio (America/Bogota)**, nunca en el del servidor.

**Invariante:** el servidor corre en UTC y Colombia está cinco horas atrás. Una venta confirmada a las 8 de la noche en Bogotá ya es del día siguiente en UTC. Agrupando por el día del servidor, esa venta aparece en la columna equivocada de la gráfica y —el último día del mes— **cae en un mes en el que no entró dinero**.

Es el peor tipo de error para un panel: la cifra es plausible, solo está mal ubicada, así que nadie la reporta. La regla ya existía en la numeración del pedido ("el año es el de Colombia, no el del servidor en UTC"); aquí se aplica a todo lo que agrupe por fecha.

#### Scenario: Venta de la noche en Bogotá

- **WHEN** una venta se confirma a las 8 de la noche hora de Colombia —ya el día siguiente en UTC—
- **THEN** cuenta en el día colombiano en que se hizo, no en el siguiente

#### Scenario: Venta del último día del mes, de noche

- **WHEN** una venta se confirma el último día del mes por la noche en Colombia
- **THEN** cuenta en ese mes, no en el siguiente

#### Scenario: Ventana de la gráfica

- **WHEN** se pinta la semana
- **THEN** son siete días **del negocio**, el último es hoy en Colombia, y exactamente uno está marcado como hoy

### Requirement: Las ventas se consultan por periodo, canal y moneda

El módulo SHALL permitir filtrar por **rango de fechas**, **canal** (web o punto de venta) y **moneda**, y SHALL mostrar para el resultado: cuántas ventas, el total por moneda y el ticket promedio por moneda.

El canal SHALL ser un filtro de primera clase desde el principio, aunque hoy solo exista el canal web.

**Invariante:** el alcance pide "ventas realizadas (online y POS)". Añadir el canal después obligaría a revisar cada consulta y cada total; dejarlo puesto desde ahora hace que el POS solo tenga que empezar a escribir sus ventas.

#### Scenario: Filtro por rango de fechas

- **WHEN** el operador elige un rango
- **THEN** ve solo las ventas confirmadas dentro de él, con sus totales recalculados

#### Scenario: Filtro por canal sin ventas presenciales

- **WHEN** filtra por punto de venta y todavía no existen ventas de ese canal
- **THEN** se le dice que no hay ventas presenciales todavía, en lugar de una tabla vacía sin explicación

#### Scenario: Sin filtros

- **WHEN** entra al módulo sin elegir nada
- **THEN** ve un periodo por defecto razonable y sabe cuál es

### Requirement: Las ventas se pueden exportar

El módulo SHALL permitir **exportar el resultado del filtro** a un archivo que se abra en una hoja de cálculo, con una fila por venta y su moneda en columna propia.

La exportación SHALL respetar los filtros aplicados y SHALL exigir un permiso propio.

**Invariante:** el alcance pide "registro y consulta"; los informes analíticos no están cotizados. Exportar es lo que permite que el negocio arme cualquier informe que necesite sin que nosotros adivinemos cuál. Y la moneda va en columna propia —no pegada al importe— porque si no, la hoja de cálculo no puede sumar.

#### Scenario: Exportación filtrada

- **WHEN** el operador exporta con un rango y un canal elegidos
- **THEN** el archivo contiene exactamente las ventas que estaba viendo

#### Scenario: Exportación sin permiso

- **WHEN** lo intenta un usuario sin el permiso de exportación
- **THEN** se rechaza, aunque pueda ver el listado

#### Scenario: Importes en la exportación

- **WHEN** se abre el archivo en una hoja de cálculo
- **THEN** los importes son números sumables y la moneda está en su propia columna

### Requirement: Cada venta se puede rastrear hasta su pedido

Cada fila SHALL mostrar el número del pedido, su fecha de confirmación, el cliente, el canal, la moneda y el total, y SHALL permitir abrir el pedido completo.

El total mostrado SHALL ser el **efectivamente cobrado**: el del snapshot del pedido, ya con descuentos y cashback aplicados.

**Invariante:** en KORA el cobro ocurre fuera de la plataforma, por WhatsApp. Si el módulo de ventas mostrara un importe distinto del que el operador cobró, la conversación con el cliente sería imposible de sostener: la única cifra defendible es la que salió en el mensaje.

#### Scenario: Venta con cupón y cashback

- **WHEN** una venta se pagó con un cupón y parte con cashback
- **THEN** el total registrado es el que el comprador pagó con dinero, no el precio de lista

#### Scenario: Ir al pedido

- **WHEN** el operador abre una venta
- **THEN** llega al detalle del pedido que la originó

### Requirement: Ver las ventas exige permiso

El módulo SHALL exigir un permiso propio para consultarlo y otro para exportar, verificados **contra la base de datos**.

**Invariante:** las ventas son la información más sensible del negocio: cuánto factura y de qué vive. Un cajero puede necesitar ver pedidos sin tener que ver la facturación completa de la empresa. Y el permiso se verifica contra la base y no contra el token porque retirárselo a alguien tiene que surtir efecto ya.

#### Scenario: Usuario sin permiso

- **WHEN** un usuario sin el permiso de ventas abre la dirección del módulo
- **THEN** no ve ninguna cifra

#### Scenario: Permiso retirado

- **WHEN** se le retira el permiso a un usuario con sesión abierta
- **THEN** deja de poder consultarlo en su siguiente acción
