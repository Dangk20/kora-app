## Purpose

Permite que un comprador demuestre quién es, y garantiza que esa identidad sirva **solo** para su cuenta en la tienda y nunca para el panel.

## ADDED Requirements

### Requirement: La sesión del comprador y la del operador no se pueden confundir

Un comprador autenticado NO SHALL poder alcanzar `/admin` ni `/pos` bajo ninguna circunstancia, y un operador autenticado NO SHALL quedar identificado como comprador en la tienda.

Las dos sesiones SHALL usar **cookies distintas y caminos de verificación distintos**: presentar la credencial de una donde se espera la otra no SHALL autenticar.

**Invariante:** es el fallo más grave que puede tener este proyecto. El panel confirma pedidos, mueve inventario y ve los datos de todos los clientes. Si las dos sesiones compartieran mecanismo, bastaría una comprobación olvidada en una ruta nueva para que un comprador entrara — y el error no se notaría hasta que alguien lo usara. Separarlas hace que la ruta nueva sea segura por omisión en vez de por acordarse.

#### Scenario: Comprador intentando entrar al panel

- **WHEN** un comprador con sesión activa navega a `/admin`
- **THEN** no accede, exactamente igual que si no tuviera ninguna sesión

#### Scenario: Comprador intentando ejecutar una acción del panel

- **WHEN** una acción protegida del panel se invoca con la sesión de un comprador
- **THEN** se rechaza por no autenticado

#### Scenario: Operador en la tienda

- **WHEN** un operador con sesión del panel navega a la cuenta de la tienda
- **THEN** no queda identificado como ningún comprador

### Requirement: La sesión se verifica contra la base y se puede revocar

Cada petición autenticada SHALL comprobar la sesión **contra la base de datos**. Cerrar sesión SHALL invalidarla de inmediato, sin esperar a que caduque.

**Invariante:** es la misma decisión que ya rige el panel, y aquí la razón es más directa: detrás de la cuenta hay dinero: saldo de cashback y el historial de compras. Un identificador que valga por sí solo hasta caducar no se puede retirar — quien lo consiga lo usa hasta el final, y el comprador que cierra sesión en un computador ajeno cree haberla cerrado.

#### Scenario: Cierre de sesión

- **WHEN** un comprador cierra sesión
- **THEN** su credencial deja de servir en la petición siguiente

#### Scenario: Sesión caducada

- **WHEN** una sesión supera su vigencia
- **THEN** deja de autenticar y el comprador vuelve a la pantalla de acceso

#### Scenario: Credencial fabricada

- **WHEN** llega una credencial que no corresponde a ninguna sesión de la base
- **THEN** no autentica

### Requirement: El registro no revela quién ya tiene cuenta

El registro y el acceso NO SHALL permitir averiguar si un correo está registrado.

**Invariante:** un mensaje que distinga "ese correo ya existe" de "correo o contraseña incorrectos" convierte el formulario en un comprobador de clientela: cualquiera puede ir preguntando correos y sacar la lista de compradores de KORA. Es un dato del negocio, no solo del comprador.

#### Scenario: Acceso con contraseña equivocada

- **WHEN** alguien intenta entrar con un correo registrado y la contraseña incorrecta
- **THEN** el mensaje es el mismo que si el correo no existiera

#### Scenario: Registro con un correo que ya tiene cuenta

- **WHEN** alguien se registra con un correo que ya tiene cuenta
- **THEN** la respuesta no confirma que existiera, y no se crea ni se modifica nada

### Requirement: Las contraseñas nunca se guardan tal cual

Las contraseñas SHALL almacenarse **cifradas de forma irreversible** y NUNCA SHALL aparecer en registros, mensajes de error ni respuestas.

La contraseña SHALL tener un mínimo exigido, y el motivo SHALL decirse antes de enviar el formulario, no después.

#### Scenario: Contraseña demasiado corta

- **WHEN** alguien elige una contraseña por debajo del mínimo
- **THEN** se le dice cuál es el mínimo antes de enviar

#### Scenario: Lo que queda guardado

- **WHEN** se crea una cuenta
- **THEN** en la base no existe la contraseña en claro

### Requirement: Un comprador es un cliente, no un registro paralelo

Una cuenta SHALL corresponder a un **cliente** del módulo de clientes: registrarse con un correo que ya es cliente —porque compró antes como invitado— SHALL darle acceso a **su historial y su cashback ya acumulado**, no crear un cliente nuevo.

**Invariante:** sin esto, el comprador que lleva meses comprando como invitado se registra y ve su cuenta vacía: su cashback estaría en un cliente y su cuenta en otro. Y para el negocio serían dos personas, con las métricas partidas por la mitad.

#### Scenario: Comprador que ya compró como invitado

- **WHEN** alguien se registra con el correo con el que ya había comprado
- **THEN** su cuenta muestra sus pedidos anteriores y su saldo de cashback

#### Scenario: Comprador nuevo

- **WHEN** se registra alguien sin compras previas
- **THEN** se crea su cliente y su cuenta queda vinculada a él

### Requirement: Los intentos de acceso son limitados

Los intentos fallidos de acceso desde un mismo origen SHALL limitarse, y el rechazo SHALL decir que hay que esperar, sin revelar si el correo existe.

**Invariante:** sin límite, probar contraseñas contra una cuenta es cuestión de tiempo y ancho de banda. Detrás de la cuenta hay saldo gastable.

#### Scenario: Muchos intentos fallidos seguidos

- **WHEN** se acumulan intentos fallidos desde el mismo origen
- **THEN** los siguientes se rechazan por un tiempo, aunque la contraseña sea correcta

### Requirement: No hay recuperación de contraseña todavía, y se dice

Mientras el dominio no tenga registros de correo, la pantalla de acceso NO SHALL ofrecer un enlace de recuperación, y SHALL indicar cómo pedir ayuda.

**Invariante:** un enlace de "olvidé mi contraseña" que no puede entregar el correo es peor que no tenerlo: el comprador lo usa, no recibe nada, lo intenta tres veces y termina creyendo que la tienda está rota. Decirle que escriba por WhatsApp lo resuelve hoy; el enlace se pone cuando el correo salga de verdad.

#### Scenario: Comprador que olvidó su contraseña

- **WHEN** un comprador no recuerda su contraseña
- **THEN** la pantalla le indica cómo pedir ayuda, sin ofrecer un flujo que no funciona
