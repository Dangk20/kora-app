## Purpose

Hace detectable el fallo que de verdad importa en un trabajo programado: no que se caiga, sino que **deje de correr en silencio** y nadie se entere hasta ver el daño.

## ADDED Requirements

### Requirement: Toda ejecución queda registrada

Cada ejecución de un trabajo SHALL dejar constancia persistente de: qué trabajo fue, cuándo empezó, cuánto tardó, si terminó bien, un resumen de lo que hizo y —si falló— el motivo.

Las ejecuciones **omitidas por solapamiento** SHALL registrarse también, distinguidas de las que sí corrieron.

**Invariante:** sin registro persistente, la única prueba de que un trabajo corrió son los registros del contenedor, que se rotan y se pierden. La pregunta "¿se cancelaron los pedidos vencidos anoche?" tiene que poder responderse mañana.

#### Scenario: Ejecución con éxito

- **WHEN** un trabajo termina correctamente
- **THEN** queda registrada su duración y un resumen de lo que hizo — por ejemplo, cuántos pedidos canceló

#### Scenario: Ejecución fallida

- **WHEN** un trabajo falla
- **THEN** queda registrado como fallido, con el motivo, sin borrar el registro de las ejecuciones anteriores

#### Scenario: Ejecución omitida

- **WHEN** una ejecución se omite porque la anterior seguía corriendo
- **THEN** queda registrada como omitida, distinguible de una ejecución que sí corrió

### Requirement: Se puede responder cuándo corrió bien cada trabajo por última vez

El sistema SHALL ofrecer una consulta que, por cada trabajo, informe cuándo terminó con éxito por última vez, cuánto hace de eso, y si ese tiempo **excede lo que su cadencia permite**.

**Invariante:** este es el requisito que da sentido a todo el change. Un trabajo que falla ruidosamente se ve; uno que dejó de programarse no se ve nunca. La señal no es "hubo un error", es **"lleva demasiado sin correr"**.

#### Scenario: Todos al día

- **WHEN** se consulta el estado con los tres trabajos corriendo en su cadencia
- **THEN** cada uno informa su última ejecución con éxito y ninguno aparece como atrasado

#### Scenario: Un trabajo dejó de correr

- **WHEN** un trabajo lleva sin ejecutarse con éxito mucho más que su cadencia
- **THEN** aparece señalado como atrasado, indicando cuánto hace de su última ejecución correcta

#### Scenario: Un trabajo nunca ha corrido

- **WHEN** se consulta un trabajo que no tiene ninguna ejecución registrada
- **THEN** se informa como tal, sin confundirlo con uno que corrió y falló

#### Scenario: La consulta refleja el problema en su código de salida

- **WHEN** hay algún trabajo atrasado o cuya última ejecución falló
- **THEN** la consulta termina con un código distinto de cero, para poder encadenarla a una comprobación automática

### Requirement: El historial no crece sin límite

El registro de ejecuciones SHALL conservar un historial acotado, suficiente para diagnosticar y sin crecer indefinidamente.

**Invariante:** tres trabajos, uno cada 5 minutos, son más de cien mil filas al año. Una tabla de diagnóstico que se convierte en el problema de espacio de la base de datos deja de servir para diagnosticar.

#### Scenario: Historial antiguo

- **WHEN** existen ejecuciones más antiguas que el periodo de retención
- **THEN** se eliminan sin afectar a la última ejecución con éxito de cada trabajo, que es el dato que sostiene el diagnóstico
