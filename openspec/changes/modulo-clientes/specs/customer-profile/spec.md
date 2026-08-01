## Purpose

Muestra de un vistazo quién es un cliente, cuánto vale, qué compra y cómo contactarlo — sin sacar al operador de la vista de clientes. Traza CLI_HU002.

## ADDED Requirements

### Requirement: Perfil en panel lateral de solo lectura

El perfil SHALL abrirse como panel lateral sobre la vista de clientes, sin bloquear el fondo por completo, y SHALL ser de **solo lectura**: no ofrece edición.

Su apertura SHALL reflejarse en la dirección de la página, de modo que sea enlazable y sobreviva a recargar.

#### Scenario: Abrir el perfil

- **WHEN** se usa la acción Ver sobre un cliente
- **THEN** se abre su perfil en panel lateral y la dirección de la página lo refleja

#### Scenario: Recargar con el perfil abierto

- **WHEN** se recarga la página con un perfil abierto
- **THEN** el perfil sigue abierto sobre el mismo cliente

#### Scenario: Cliente inexistente

- **WHEN** la dirección apunta a un cliente que no existe
- **THEN** la vista de clientes se muestra sin panel, sin error

### Requirement: Identidad y contacto del cliente

El encabezado SHALL mostrar avatar de iniciales, nombre completo, WhatsApp, correo, última dirección de entrega y país con su moneda. Los datos ausentes SHALL indicarse como no registrados, nunca en blanco.

SHALL distinguirse si el cliente **tiene cuenta** de acceso o compró como **invitado**.

#### Scenario: Cliente sin correo ni dirección

- **WHEN** se abre el perfil de un cliente que solo tiene teléfono
- **THEN** el correo y la dirección se muestran como no registrados, y el perfil funciona igual

#### Scenario: Cliente invitado

- **WHEN** el cliente nunca creó cuenta de acceso
- **THEN** se indica como invitado

### Requirement: Tres métricas sobre pedidos confirmados

El perfil SHALL mostrar: **pedidos** (total histórico de confirmados), **inactivo** (días desde el último confirmado) y **ticket promedio** (gasto confirmado dividido entre pedidos confirmados).

El ticket promedio SHALL expresarse en la **moneda predominante** del cliente. Si tiene pedidos en la otra moneda, SHALL indicarse aparte cuántos.

Un cliente sin pedidos confirmados SHALL mostrar cero pedidos, "sin pedidos" como inactividad y cero de ticket — nunca un error ni una división indefinida.

**Invariante:** las dos monedas del sistema **nunca se suman ni se convierten**. No existe tasa de cambio en KORA y es deliberado: cada divisa usa su propio precio cargado. Un ticket promedio que mezclara pesos y dólares sería un número sin significado que además parecería correcto.

#### Scenario: Cliente con pedidos en una sola moneda

- **WHEN** todos los pedidos confirmados del cliente están en la misma moneda
- **THEN** el ticket promedio se expresa en esa moneda, sin nota adicional

#### Scenario: Cliente con pedidos en las dos monedas

- **WHEN** el cliente tiene pedidos confirmados en pesos y en dólares
- **THEN** el ticket promedio se calcula sobre la moneda predominante y se indica aparte cuántos pedidos hay en la otra, **sin sumarlas ni convertirlas**

#### Scenario: Cliente sin compras

- **WHEN** el cliente no tiene ningún pedido confirmado
- **THEN** las tres métricas muestran sus valores vacíos sin error

#### Scenario: Pedidos no confirmados

- **WHEN** el cliente tiene pedidos pendientes o cancelados
- **THEN** ninguna de las tres métricas los cuenta

### Requirement: Saldo de fidelización visible aunque el módulo no exista

El perfil SHALL mostrar el saldo de fidelización del cliente. Mientras el módulo de fidelización no esté activo, SHALL mostrar **cero sin error**.

**Invariante:** es lo que permite construir esta pantalla sin esperar a que se cierren las reglas del cashback. El hueco queda hecho; llenarlo será conectar una consulta.

#### Scenario: Sin módulo de fidelización activo

- **WHEN** se abre el perfil de cualquier cliente
- **THEN** el bloque de saldo muestra cero, sin error y sin ocultarse

### Requirement: Contacto por WhatsApp

SHALL ofrecerse una acción de contacto por WhatsApp hacia el teléfono del cliente.

El enlace SHALL construirse con el punto de entrada `api.whatsapp.com/send`. **NO SHALL usarse `wa.me`.**

**Invariante:** la especificación de la historia de usuario pide `wa.me`, y está equivocada. Su redirección re-codifica el texto y **rompe los caracteres de 4 bytes**: el emoji del saludo del mensaje de pedido llegaba partido. Ya se resolvió una vez en el flujo de pedidos; queda escrito aquí para que no vuelva por la puerta de atrás al leer la historia.

#### Scenario: Cliente con teléfono

- **WHEN** se usa la acción de contacto
- **THEN** se abre WhatsApp hacia ese número usando `api.whatsapp.com/send`

#### Scenario: Cliente sin teléfono

- **WHEN** el cliente no tiene teléfono registrado
- **THEN** la acción de contacto no se ofrece o queda deshabilitada, en vez de generar un enlace roto

### Requirement: Top cinco de categorías compradas

SHALL mostrarse hasta cinco categorías, ordenadas por unidades compradas de forma descendente, con las unidades y el gasto en cada una. Los empates SHALL resolverse por mayor gasto.

SHALL incluirse únicamente categorías donde el cliente **realmente compró**, contando solo pedidos confirmados. Sin compras confirmadas, SHALL mostrarse un estado vacío explícito.

El cálculo SHALL resolverse con consultas agregadas, sin traer los pedidos del cliente a la aplicación.

#### Scenario: Cliente con compras en varias categorías

- **WHEN** el cliente compró en más de cinco categorías
- **THEN** se muestran las cinco con más unidades, ordenadas de mayor a menor

#### Scenario: Empate en unidades

- **WHEN** dos categorías tienen las mismas unidades
- **THEN** aparece primero la de mayor gasto

#### Scenario: Cliente sin compras confirmadas

- **WHEN** el cliente no tiene pedidos confirmados
- **THEN** se muestra un estado vacío que lo dice, no una lista en blanco
