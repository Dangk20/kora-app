## Purpose

Convierte los eventos de dominio acumulados en la bandeja de salida en efectos reales, con la garantía de que cada uno se procesa hasta el final o queda visiblemente muerto — nunca a medias y nunca dos veces con efecto doble.

## ADDED Requirements

### Requirement: Todo evento pendiente termina procesado o muerto

El sistema SHALL tomar los eventos en estado pendiente y llevarlos a un estado terminal: **procesado** si sus manejadores tuvieron éxito, o **muerto** si agotaron sus intentos.

Ningún evento SHALL quedar indefinidamente en un estado intermedio. Si un proceso muere mientras trabaja un evento, ese evento SHALL volver a estar disponible para otro intento.

**Invariante:** la bandeja de salida es un compromiso, no una sugerencia. Un evento escrito ahí ya ocurrió en el negocio: el pedido se confirmó y el stock se descontó. Si nadie lo procesa, el sistema queda en un estado que contradice lo que el cliente ya vivió.

#### Scenario: Evento pendiente

- **WHEN** existe un evento pendiente cuyo tipo tiene manejador registrado
- **THEN** en el siguiente ciclo se procesa y queda en estado procesado, con su marca de tiempo

#### Scenario: El proceso muere a mitad de un evento

- **WHEN** un trabajador toma un evento y termina abruptamente sin dejarlo en estado terminal
- **THEN** transcurrido un tiempo acotado ese evento vuelve a estar disponible y otro intento lo procesa

#### Scenario: Evento sin manejador registrado

- **WHEN** se encuentra un evento de un tipo que ningún manejador atiende
- **THEN** NO se marca como procesado ni se reintenta indefinidamente: queda registrado como no atendido y visible en el diagnóstico

### Requirement: Dos trabajadores no toman el mismo evento

Cuando varios procesos consumen la bandeja al mismo tiempo, cada evento SHALL ser entregado a **un solo** trabajador por intento.

**Invariante:** es la misma clase de problema que el motor de inventario resuelve para el stock. Aquí el efecto de un doble procesamiento es acreditar dinero dos veces, así que la exclusión no puede depender de que "en la práctica solo corre un worker".

#### Scenario: Dos trabajadores compiten por la misma bandeja

- **WHEN** dos procesos consumen simultáneamente una bandeja con eventos pendientes
- **THEN** ningún evento es tomado por ambos, y entre los dos procesan todos los eventos pendientes exactamente una vez

#### Scenario: Un trabajador lento no bloquea al otro

- **WHEN** un trabajador está ocupado procesando un evento y otro pide trabajo
- **THEN** el segundo recibe eventos distintos en vez de esperar a que el primero termine

### Requirement: Reprocesar un evento no duplica sus efectos

La entrega es **al menos una vez**: un mismo evento puede entregarse más de una vez tras un fallo o una caída. Todo manejador SHALL ser idempotente — procesar dos veces el mismo evento SHALL producir el mismo estado final que procesarlo una vez.

**Invariante:** el primer consumidor real acredita dinero al cliente. Sin idempotencia, un reintegro tras un fallo de red se convierte en un saldo regalado. La propiedad se fija con una prueba automatizada, no con una convención.

#### Scenario: El mismo evento se procesa dos veces

- **WHEN** un evento ya procesado vuelve a entregarse a su manejador
- **THEN** el estado del sistema es idéntico al que había tras el primer procesamiento, sin efectos añadidos

#### Scenario: Fallo después de aplicar el efecto

- **WHEN** un manejador aplica su efecto y el proceso muere antes de marcar el evento como procesado
- **THEN** el reintento posterior no vuelve a aplicar el efecto, y el evento queda correctamente marcado

### Requirement: Los reintentos son acotados y espaciados

Un evento que falla SHALL reintentarse con una espera **creciente** entre intentos, hasta un número máximo. Alcanzado ese máximo SHALL quedar en estado terminal muerto, conservando el **motivo del último fallo**.

Un evento en espera de su próximo intento NO SHALL ser tomado antes de que corresponda.

**Invariante:** sin espera creciente, un manejador que falla por una dependencia caída se reintenta en bucle cerrado y convierte un problema pasajero en carga sostenida. Sin límite, un evento imposible de procesar se reintenta para siempre y nadie se entera.

#### Scenario: Primer fallo

- **WHEN** un manejador lanza un error al procesar un evento
- **THEN** el evento vuelve a pendiente con su contador de intentos incrementado, el motivo del fallo registrado, y no se toma de nuevo hasta que pase su espera

#### Scenario: Se agotan los intentos

- **WHEN** un evento alcanza el número máximo de intentos y vuelve a fallar
- **THEN** queda en estado terminal muerto, con el motivo del último fallo, y no se vuelve a tomar

#### Scenario: La espera se respeta

- **WHEN** un evento acaba de fallar y su próxima oportunidad aún no ha llegado
- **THEN** el trabajador lo ignora y toma otros eventos

### Requirement: Añadir un manejador no obliga a tocar el motor

Los manejadores SHALL registrarse por tipo de evento. Incorporar un consumidor nuevo SHALL consistir en registrarlo, sin modificar la lógica de consumo.

Un tipo de evento PUEDE tener varios manejadores.

#### Scenario: Manejador nuevo

- **WHEN** se registra un manejador para un tipo de evento existente
- **THEN** empieza a recibir esos eventos sin que el motor de consumo cambie

#### Scenario: Varios manejadores para el mismo evento

- **WHEN** un evento tiene más de un manejador registrado y uno de ellos falla
- **THEN** el evento se reintenta completo, y los manejadores que ya habían tenido éxito no duplican su efecto gracias a su idempotencia

### Requirement: El worker respeta las reglas del dominio

El consumidor y sus manejadores NO SHALL modificar existencias fuera del motor de inventario, NO SHALL calcular precios por su cuenta, y NO SHALL provocar transiciones de estado de pedido que la máquina de estados no permita.

**Invariante:** correr fuera del ciclo de petición y respuesta no otorga permisos especiales. Un proceso de fondo que escribe stock directamente rompe la única garantía de correctitud del sistema, y lo hace sin que nadie lo vea en una pantalla.

#### Scenario: Un manejador necesita mover existencias

- **WHEN** un manejador requiere modificar el stock de una variante
- **THEN** lo hace invocando al motor de inventario, que registra el movimiento en el libro contable y materializa el saldo en la misma transacción

#### Scenario: Un manejador intenta una transición no permitida

- **WHEN** un manejador intenta llevar un pedido a un estado que la máquina de estados no admite desde el actual
- **THEN** la operación es rechazada y el evento se trata como fallido, sin dejar el pedido en un estado inválido
