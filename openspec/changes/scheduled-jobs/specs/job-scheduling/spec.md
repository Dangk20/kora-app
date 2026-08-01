## Purpose

Ejecuta los trabajos periódicos del sistema en su cadencia, garantizando que ninguno se ejecute encima de sí mismo y que un trabajo lento o roto no impida correr a los demás.

## ADDED Requirements

### Requirement: Cada trabajo corre en su cadencia

El sistema SHALL ejecutar automáticamente, sin intervención:

| Trabajo | Cadencia | Por qué esa |
|---|---|---|
| Expiración de pedidos pendientes | Cada 5 minutos | Un pedido vence a las 2 h; 5 min acota el error a un margen despreciable frente a esa ventana |
| Verificación del libro contable de inventario | Diaria, de madrugada | Recorre todo el inventario: se hace cuando no compite con compradores |
| Diagnóstico de la bandeja de salida | Cada 15 minutos | Suficiente para detectar un atasco antes de que importe, sin convertir el registro en ruido |

#### Scenario: Ejecución periódica

- **WHEN** transcurre la cadencia de un trabajo desde su última ejecución
- **THEN** el trabajo se ejecuta sin que nadie lo pida

#### Scenario: Arranque del sistema

- **WHEN** el programador arranca
- **THEN** los trabajos cuya cadencia ya venció mientras estaba detenido se ejecutan **una sola vez**, sin reponer todas las ejecuciones perdidas

### Requirement: Un trabajo nunca se ejecuta encima de sí mismo

Si una ejecución sigue en curso cuando le toca volver a correr, esa nueva ejecución NO SHALL iniciarse: se omite y queda registrada como omitida.

**Invariante:** la expiración **cancela pedidos**. Dos ejecuciones simultáneas sobre el mismo pedido pendiente compiten por cambiarle el estado; que hoy la probabilidad sea baja no es una garantía, es una apuesta sobre datos de ventas reales.

#### Scenario: Una ejecución tarda más que su cadencia

- **WHEN** llega el momento de ejecutar un trabajo que todavía está corriendo
- **THEN** la nueva ejecución se omite y se deja constancia, sin lanzar un segundo proceso del mismo trabajo

#### Scenario: Dos programadores a la vez

- **WHEN** existe más de un programador activo (por ejemplo, durante un despliegue solapado)
- **THEN** un mismo trabajo no se ejecuta simultáneamente en ambos

### Requirement: Un trabajo roto no arrastra a los demás

El fallo de un trabajo NO SHALL impedir que los demás se ejecuten en su cadencia, ni SHALL detener el programador.

**Invariante:** los tres trabajos son independientes. Que la verificación del libro contable falle no puede impedir que los pedidos vencidos se cancelen — precisamente cuando algo va mal es cuando más falta hacen los demás.

#### Scenario: Un trabajo lanza un error

- **WHEN** un trabajo falla durante su ejecución
- **THEN** el fallo queda registrado con su motivo, el programador sigue vivo y los demás trabajos corren en su cadencia

#### Scenario: Un trabajo se cuelga

- **WHEN** un trabajo supera un tiempo máximo razonable sin terminar
- **THEN** se marca su ejecución como fallida por tiempo agotado y no bloquea indefinidamente las siguientes

### Requirement: Parada ordenada

Cuando el sistema pide al programador que termine, SHALL dejar de lanzar trabajos nuevos y esperar a que termine el que esté en curso antes de salir.

**Invariante:** matar la expiración a mitad de camino puede dejar unos pedidos cancelados y otros no, sin que quede claro cuáles. Es recuperable —la siguiente ejecución los retoma— pero solo si el registro dice que esa ejecución no terminó.

#### Scenario: Señal de término durante una ejecución

- **WHEN** llega la señal de término mientras un trabajo corre
- **THEN** el programador no lanza más trabajos, espera al actual y solo entonces sale

### Requirement: Los trabajos respetan las reglas del dominio

La expiración de pedidos SHALL cambiar estados únicamente a través de la máquina de estados del pedido. La verificación del libro contable SHALL ser de **solo lectura**. Ningún trabajo SHALL modificar existencias fuera del motor de inventario.

**Invariante:** correr sin nadie mirando no otorga permisos especiales — los reduce. Que la verificación **avise y no corrija** es deliberado: un libro contable descuadrado es un síntoma, y corregirlo automáticamente borra la evidencia del problema que hay que investigar.

#### Scenario: Expiración de un pedido

- **WHEN** el trabajo de expiración cancela un pedido vencido
- **THEN** la transición pasa por la máquina de estados y queda registrada en el historial del pedido

#### Scenario: Un pedido en un estado no cancelable

- **WHEN** un pedido vencido está en un estado desde el que la máquina de estados no permite cancelar
- **THEN** no se cancela, y el hecho queda registrado en lugar de forzar el estado

#### Scenario: El libro contable no cuadra

- **WHEN** la verificación encuentra una variante cuyo saldo materializado no coincide con la suma de sus movimientos
- **THEN** lo reporta como fallo con el detalle de la divergencia y **no modifica ningún dato**
