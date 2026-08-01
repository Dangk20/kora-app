## Purpose

Da al operador una vista única de la base de clientes: cuántos hay, cuántos siguen activos, y quiénes son — con búsqueda y paginado que aguantan una base real. Traza CLI_HU001.

## ADDED Requirements

### Requirement: Resumen de la base en cuatro indicadores

La vista SHALL mostrar cuatro indicadores calculados en tiempo real:

| Indicador | Qué cuenta |
|---|---|
| **Clientes nuevos** | Registros creados en los últimos 30 días |
| **Clientes activos** | Clientes con al menos un **pedido confirmado** en los últimos 30 días |
| **Total de clientes** | Total histórico de la base |
| **Clientes con cuenta** | Clientes que crearon cuenta de acceso, frente a compradores invitados |

Cuando no haya datos, cada indicador SHALL mostrar **cero**, sin error.

**Invariante:** "activo" significa **compró y esa compra se confirmó**. Un pedido pendiente o cancelado no vuelve activo a nadie — si lo hiciera, el indicador contaría intenciones en vez de ventas, y el operador tomaría decisiones de remarketing sobre gente que nunca compró.

#### Scenario: Base con actividad

- **WHEN** se abre la vista con clientes registrados y pedidos confirmados recientes
- **THEN** los cuatro indicadores muestran valores coherentes con el listado

#### Scenario: Base vacía

- **WHEN** se abre la vista sin ningún cliente
- **THEN** los cuatro indicadores muestran cero y el listado informa que no hay clientes, sin error

#### Scenario: Un cliente con pedido pendiente

- **WHEN** un cliente tiene un pedido creado pero **sin confirmar** en los últimos 30 días, y ningún confirmado
- **THEN** cuenta en el total y, si es reciente, en "nuevos" — pero **NO** cuenta como activo

#### Scenario: Un cliente con pedido cancelado

- **WHEN** el único pedido reciente de un cliente fue cancelado
- **THEN** no cuenta como activo

### Requirement: Listado con la información operativa del cliente

El listado SHALL mostrar por cada cliente: nombre completo con avatar de iniciales, número de WhatsApp, correo electrónico, país, los **días de la semana en que más pedidos confirmados** ha hecho, y las acciones **Ver** y **Editar**.

El orden SHALL ser por fecha de creación descendente.

NO SHALL existir acción de eliminar. NO SHALL existir columna de "tipo de cliente".

**Invariante:** que no se pueda eliminar no es una carencia: el histórico es permanente porque alimenta el remarketing y la fidelización. Un cliente borrado se lleva consigo las compras que explican su saldo.

#### Scenario: Cliente sin correo

- **WHEN** un cliente no tiene correo registrado
- **THEN** su fila lo indica sin romper el listado, y el cliente sigue siendo válido

#### Scenario: Días de mayor pedido

- **WHEN** un cliente tiene pedidos confirmados concentrados en ciertos días de la semana
- **THEN** el listado resalta esos días, contando **solo** pedidos confirmados

#### Scenario: Cliente sin compras

- **WHEN** un cliente no tiene ningún pedido confirmado
- **THEN** aparece en el listado sin ningún día resaltado

#### Scenario: No hay forma de eliminar

- **WHEN** se revisan las acciones disponibles sobre un cliente
- **THEN** solo existen Ver y Editar

### Requirement: Búsqueda y paginado resueltos en servidor

La búsqueda SHALL filtrar por nombre, teléfono o correo, y SHALL resolverse **en servidor**, igual que el paginado.

**Invariante:** filtrar en el navegador exigiría traer la base completa. La HU pide explícitamente que la vista aguante miles de clientes, y una búsqueda que carga todo para filtrar deja de funcionar justo cuando el negocio empieza a tener valor.

#### Scenario: Búsqueda por nombre parcial

- **WHEN** se escribe parte de un nombre
- **THEN** el listado muestra los clientes que coinciden, sin distinguir mayúsculas ni acentos

#### Scenario: Búsqueda por teléfono

- **WHEN** se escribe un teléfono o parte de él
- **THEN** encuentra al cliente aunque se escriba con o sin el indicativo del país

#### Scenario: Búsqueda sin resultados

- **WHEN** ningún cliente coincide
- **THEN** se informa que no hay resultados, sin error y conservando lo escrito

#### Scenario: La base no cabe en una página

- **WHEN** hay más clientes de los que caben en una página
- **THEN** se navega entre páginas y cada una se consulta al servidor

### Requirement: El acceso al módulo se controla por permiso propio

La vista SHALL exigir permiso de consulta de clientes. Crear y editar SHALL exigir sus propios permisos, verificados **contra la base de datos** en cada acción protegida.

El módulo de permisos SHALL llamarse `customers`. NO SHALL llamarse `crm`.

**Invariante:** la nomenclatura no es cosmética. "CRM" nombra un producto mucho más grande del que se vendió, y el acuerdo con el cliente es no usar esa palabra en ninguna parte. Un permiso es un nombre que acaba apareciendo en pantallas de administración y en conversaciones.

#### Scenario: Usuario sin permiso de consulta

- **WHEN** un usuario sin el permiso de consulta de clientes intenta abrir la vista
- **THEN** no accede

#### Scenario: Permiso revocado en caliente

- **WHEN** se revoca el permiso a un usuario con sesión abierta y este intenta una acción protegida
- **THEN** la acción es rechazada, porque el permiso se verifica contra la base y no contra la sesión

#### Scenario: La matriz de permisos no contiene "crm"

- **WHEN** se inspecciona la matriz de permisos del sistema
- **THEN** existe el módulo `customers` y **no** existe ningún módulo llamado `crm`

#### Scenario: Los permisos ya concedidos sobreviven al renombrado

- **WHEN** se aplica el renombrado sobre una base que ya tenía permisos de `crm` asignados a roles
- **THEN** esos roles conservan los permisos equivalentes bajo el nombre nuevo, sin quedarse sin acceso
