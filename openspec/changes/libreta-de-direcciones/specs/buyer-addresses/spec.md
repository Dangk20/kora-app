## Purpose

La libreta de direcciones de un comprador con cuenta: guardar varias direcciones de entrega, elegir cuál manda por omisión y reutilizarlas al comprar sin volver a escribirlas. Define también qué NO puede hacer una dirección: tocar un pedido que ya se hizo.

## ADDED Requirements

### Requirement: Varias direcciones por comprador, con una predeterminada

El sistema SHALL permitir que un comprador con cuenta guarde varias direcciones de entrega y SHALL mantener exactamente una marcada como predeterminada mientras tenga al menos una.

#### Scenario: Primera dirección
- **WHEN** un comprador sin direcciones guarda la primera
- **THEN** queda marcada como predeterminada sin que tenga que pedirlo

#### Scenario: Cambiar cuál manda
- **WHEN** marca otra dirección como predeterminada
- **THEN** la anterior deja de serlo
- **AND** nunca hay dos predeterminadas a la vez

#### Scenario: Borrar la predeterminada
- **WHEN** borra la dirección predeterminada y le quedan otras
- **THEN** otra pasa a ser la predeterminada automáticamente
- **AND** el comprador no se queda sin ninguna marcada

### Requirement: Una dirección es de su dueño y de nadie más

El sistema SHALL identificar al comprador **dentro de la consulta** en toda lectura, edición o borrado de una dirección, nunca con una comprobación posterior al resultado.

#### Scenario: Dirección de otra persona
- **WHEN** llega una petición para editar o borrar una dirección que no pertenece al comprador de la sesión
- **THEN** no se modifica nada
- **AND** la respuesta no revela si esa dirección existe

#### Scenario: Sin sesión
- **WHEN** no hay sesión de comprador
- **THEN** no hay libreta: ni se lee ni se escribe

### Requirement: La libreta llena el formulario, no reescribe el pedido

El sistema NO SHALL modificar los datos de entrega de un pedido ya creado cuando la dirección que se usó cambie o se borre. El pedido conserva su propio snapshot (`shipCountry`, `shipState`, `shipCity`, `shipAddress`, `shipAddress2`, `shipNeighborhood`, `shipZip`).

#### Scenario: Editar una dirección después de comprar
- **WHEN** el comprador corrige una dirección con la que ya hizo un pedido
- **THEN** el pedido sigue mostrando la dirección con la que se hizo

#### Scenario: Borrar una dirección usada
- **WHEN** borra una dirección que un pedido pasado usó
- **THEN** el borrado se completa
- **AND** el pedido conserva íntegros sus datos de entrega

### Requirement: Elegir la dirección al comprar

El sistema SHALL ofrecer al comprador con sesión sus direcciones guardadas en el checkout, y SHALL llenar los campos de entrega con la elegida. Elegir una dirección NO SHALL impedir escribir otra distinta.

#### Scenario: Compra con dirección guardada
- **WHEN** un comprador con al menos una dirección entra al checkout
- **THEN** aparece seleccionada la predeterminada y los campos de entrega ya vienen llenos con ella

#### Scenario: Comprar a otra dirección
- **WHEN** elige escribir una dirección distinta
- **THEN** los campos quedan editables y vacíos para llenarlos
- **AND** puede pedir que esa dirección se guarde en su libreta

#### Scenario: País de la dirección y moneda de la tienda
- **WHEN** la dirección elegida es de un país distinto al del formulario en curso
- **THEN** el formulario cambia al país de esa dirección, con sus campos propios (departamento y barrio en Colombia; estado y ZIP en EE.UU.)

#### Scenario: Comprador sin direcciones o sin sesión
- **WHEN** no hay sesión, o el comprador no tiene ninguna dirección guardada
- **THEN** el checkout se comporta como hoy: formulario vacío, sin selector

### Requirement: La dirección deja de vivir en "Mis datos"

El sistema NO SHALL ofrecer ciudad ni dirección como campos editables en la sección de datos personales de la cuenta. Esa sección queda con nombre, correo y WhatsApp.

#### Scenario: Un solo sitio donde se contesta dónde vives
- **WHEN** el comprador abre sus datos personales
- **THEN** no hay ningún campo de ciudad ni de dirección
- **AND** encuentra sus direcciones en su propia sección

### Requirement: El panel sigue viendo una dirección por cliente

El sistema SHALL mantener `customer.city` y `customer.address` reflejando la dirección predeterminada del comprador, para que el módulo de clientes del panel siga funcionando sin cambios para el operador.

#### Scenario: El comprador cambia su predeterminada
- **WHEN** marca otra dirección como predeterminada
- **THEN** la ficha del cliente en el panel muestra esa dirección

#### Scenario: El operador edita la dirección desde el panel
- **WHEN** el operador cambia la dirección de un cliente en el módulo de clientes
- **THEN** se actualiza la dirección predeterminada de ese cliente
- **AND** no se crean direcciones nuevas sin que nadie lo pida

### Requirement: Nadie pierde lo que ya tenía escrito

La migración SHALL convertir en dirección predeterminada la `city`/`address` que cada cliente ya tenga guardada.

#### Scenario: Cliente con dirección previa
- **WHEN** se aplica la migración sobre un cliente que ya tenía ciudad o dirección
- **THEN** estrena una dirección predeterminada con esos valores

#### Scenario: Cliente sin dirección previa
- **WHEN** el cliente no tenía ni ciudad ni dirección
- **THEN** no se le crea ninguna dirección vacía
