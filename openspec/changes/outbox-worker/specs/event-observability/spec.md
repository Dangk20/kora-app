## Purpose

Permite saber si la bandeja de salida está sana sin abrir la base de datos, y que un atasco lo descubra el operador antes que el cliente.

## ADDED Requirements

### Requirement: Diagnóstico de la bandeja bajo demanda

El sistema SHALL ofrecer una forma de consultar, en cualquier momento y sin escribir consultas SQL a mano: cuántos eventos están pendientes, cuántos en proceso, cuántos procesados, cuántos muertos, y **la antigüedad del evento pendiente más viejo**.

**Invariante:** la antigüedad del más viejo es el dato que importa. Un número de pendientes alto es normal en una ráfaga de confirmaciones; un evento pendiente desde hace horas significa que la cola está atascada, y son dos situaciones opuestas que un simple conteo no distingue.

#### Scenario: Bandeja sana

- **WHEN** se consulta el diagnóstico con la cola al día
- **THEN** informa cero eventos muertos y una antigüedad del pendiente más viejo del orden del intervalo de sondeo

#### Scenario: Cola atascada

- **WHEN** el worker lleva tiempo detenido y se acumulan eventos pendientes
- **THEN** el diagnóstico refleja el conteo acumulado y una antigüedad creciente del pendiente más viejo

#### Scenario: Eventos muertos

- **WHEN** existen eventos que agotaron sus intentos
- **THEN** el diagnóstico los reporta por separado, con su tipo y el motivo del último fallo

### Requirement: Un evento muerto conserva por qué murió

Todo evento en estado terminal muerto SHALL conservar el motivo del último fallo y su número de intentos.

**Invariante:** un evento muerto es una tarea de negocio que no ocurrió — un cashback sin acreditar, un correo sin enviar. Sin el motivo, la única salida es reproducir el fallo a ciegas.

#### Scenario: Consultar un evento muerto

- **WHEN** se inspecciona un evento que agotó sus intentos
- **THEN** se puede leer el motivo del último fallo, cuántos intentos hubo y cuándo fue el último

### Requirement: El worker deja rastro de su actividad

El proceso SHALL registrar su arranque, su parada y el resultado de cada evento procesado, de forma que los registros del contenedor permitan reconstruir qué hizo.

Los registros NO SHALL contener datos personales del comprador ni secretos.

#### Scenario: Arranque

- **WHEN** el worker arranca
- **THEN** deja constancia de que está activo y con qué intervalo de sondeo

#### Scenario: Procesamiento

- **WHEN** procesa un evento, con éxito o con fallo
- **THEN** deja constancia del identificador del evento, su tipo y el resultado — sin volcar el contenido completo del evento

#### Scenario: Parada ordenada

- **WHEN** el sistema pide al proceso que termine
- **THEN** deja de tomar eventos nuevos, termina el que tiene entre manos y solo entonces sale

### Requirement: Reintentar un evento muerto es una acción deliberada

Un evento muerto NO SHALL volver a intentarse por sí solo. SHALL existir una forma explícita de devolverlo a la cola una vez corregida la causa.

**Invariante:** si los eventos muertos revivieran solos, el estado terminal no significaría nada y el problema volvería en bucle. Reintentar es una decisión de quien ya entendió y arregló el fallo.

#### Scenario: Reintento tras corregir la causa

- **WHEN** se corrige el problema que mató a un evento y se pide reintentarlo
- **THEN** vuelve a estado pendiente con su contador de intentos reiniciado y se procesa en el siguiente ciclo

#### Scenario: Sin intervención no revive

- **WHEN** un evento lleva tiempo en estado muerto y nadie interviene
- **THEN** sigue muerto, sin consumir intentos ni aparecer entre los pendientes
