## Purpose

Cuánto correo ha salido por el proveedor en el día y en el mes, contra qué
límite, y qué pasa cuando una campaña no cabe en lo que queda.

## ADDED Requirements

### Requirement: Todo correo que sale por el proveedor queda contado

Cada envío aceptado por el proveedor SHALL quedar registrado con su
identificador, destinatario y momento, **sin importar quién lo originó** (un
pedido, una campaña, un correo de prueba). Los correos escritos a disco NO SHALL
contarse.

**Invariante:** el proveedor no expone su contador y la clave es de solo envío.
Si el registro dependiera de que cada módulo se acordara de anotar, el correo
de prueba —que hoy no deja rastro— consumiría cupo invisible.

#### Scenario: Un correo de pedido sale por el proveedor

- **WHEN** el proveedor acepta un correo transaccional
- **THEN** existe un registro con su identificador y la fecha

#### Scenario: Un correo de prueba de campaña

- **WHEN** el operador envía una prueba de campaña a su propio correo por el proveedor
- **THEN** cuenta igual que cualquier otro

#### Scenario: Un correo va a disco

- **WHEN** en pruebas un correo se escribe a disco porque el destinatario no está permitido
- **THEN** no se registra consumo

### Requirement: El consumo se muestra contra el límite configurado

El panel de campañas SHALL mostrar el consumo del día y del mes contra los
límites configurados. Los límites SHALL ser configurables por variable de
entorno, con los del plan gratuito del proveedor por defecto (100 al día,
3.000 al mes).

**Invariante:** el día y el mes se cuentan en **UTC**, que es la referencia más
probable del proveedor; contarlos en Bogotá adelantaría el corte cinco horas y
haría creer que queda cupo que ya no queda.

#### Scenario: Consumo visible

- **WHEN** el operador abre Campañas
- **THEN** ve "hoy N de X" y "este mes N de Y", con el porcentaje

#### Scenario: Límite cambiado por configuración

- **WHEN** `KORA_EMAIL_DAILY_LIMIT` vale 1000
- **THEN** la barra del día se mide contra 1000

### Requirement: Una campaña avisa antes de arrancar si no cabe

Al enviar una campaña, si su audiencia supera lo que queda del **mes**, el
envío NO SHALL arrancar y SHALL decir cuántos caben. Si cabe en el mes pero
supera lo que queda del **día**, el envío SHALL avisar cuántos saldrán hoy y
cuántos en los días siguientes, y SHALL requerir confirmación.

**Invariante:** el módulo ya drena en días sucesivos ante un rechazo por cupo;
lo que falta no es el mecanismo, es que el operador **lo sepa antes** y no
descubra a la mañana siguiente que la mitad no salió.

#### Scenario: No cabe en el mes

- **WHEN** quedan 200 envíos del mes y la campaña tiene 450 destinatarios
- **THEN** no arranca y el mensaje dice que caben 200

#### Scenario: Cabe en el mes, no en el día

- **WHEN** quedan 80 envíos hoy y 2.000 del mes, y la campaña tiene 450
- **THEN** avisa que saldrán 80 hoy y el resto en los días siguientes, y pide confirmar

#### Scenario: Cabe

- **WHEN** la audiencia cabe en lo que queda del día
- **THEN** arranca sin aviso
