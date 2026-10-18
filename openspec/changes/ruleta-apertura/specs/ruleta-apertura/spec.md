## ADDED Requirements

### Requirement: Un giro por persona

Cada cuenta y cada celular SHALL girar la ruleta una sola vez. El premio SHALL decidirlo el servidor y SHALL quedar como beneficio de origen Ruleta con vigencia de 30 días.

#### Scenario: Segundo intento con otra cuenta y el mismo celular
- **WHEN** una cuenta nueva intenta girar con un celular que ya giró
- **THEN** el giro se rechaza con "Ese celular ya giró la ruleta"

### Requirement: Topes y disponibilidad

Un premio con tope alcanzado, con peso cero o cuyo producto no tenga inventario SHALL dejar de salir. Los giros simultáneos SHALL serializarse para que ningún tope se supere.

#### Scenario: La única prenda de regalo
- **WHEN** cinco personas giran a la vez y el único premio disponible tiene tope 1
- **THEN** exactamente una lo gana y las demás reciben "Se acabaron los premios"

### Requirement: Registro desde la ruleta

Sin sesión, tocar "Girar" SHALL pedir nombre, celular, correo y la aceptación del tratamiento de datos, sin contraseña; las promociones SHALL ser un sí aparte. La cuenta SHALL crearse con una contraseña temporal propia enviada por correo, que el primer acceso SHALL obligar a cambiar. Al crear la cuenta la ruleta SHALL girar sin otro clic.

#### Scenario: Cuenta creada
- **WHEN** la persona completa el registro
- **THEN** queda con sesión, la ruleta gira, el premio aparece en "Mis beneficios" y le llega un correo con su contraseña temporal

#### Scenario: Primer acceso con la contraseña temporal
- **WHEN** entra con la contraseña del correo
- **THEN** la tienda le pide crear una contraseña nueva antes de seguir

### Requirement: Panel de la ruleta

El administrador SHALL poder abrir o cerrar la ruleta y ajustar peso y tope de cada premio sin desplegar. El panel SHALL mostrar la probabilidad de cada premio, los giros, los premios usados y el QR del dominio actual.

#### Scenario: Ruleta cerrada
- **WHEN** la ruleta está cerrada
- **THEN** `/ruleta` lo dice y ningún giro se registra

### Requirement: Datos de contacto válidos

El registro rápido SHALL aceptar solo un celular colombiano de 10 dígitos que empiece por 3 y un correo con forma válida cuyo dominio reciba correo. La validación SHALL hacerse en el formulario y repetirse en el servidor.

#### Scenario: Datos de relleno
- **WHEN** alguien escribe "6012345" o "pepe@dominio-inventado.com"
- **THEN** el formulario lo marca y no se crea ninguna cuenta
