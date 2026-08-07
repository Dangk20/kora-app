## Purpose

La restauración de un respaldo: cómo se recupera el negocio a partir de un archivo cifrado, y la comprobación —ejecutada, no prometida— de que ese camino funciona de verdad.

## ADDED Requirements

### Requirement: El ciclo completo se verifica automáticamente

SHALL existir una verificación ejecutable que recorra el ciclo entero contra una base real: volcar, cifrar, descifrar, restaurar en una base desechable y comprobar que los datos restaurados coinciden con los de origen.

La verificación NO SHALL limitarse a comprobar que el archivo existe o que pesa más de cero bytes. La mayoría de los sistemas de copia que fallan no fallan al copiar: fallan al restaurar, meses después, cuando alguien descubre que el volcado estaba truncado, que le faltaba una extensión o que la versión de PostgreSQL no coincide.

#### Scenario: Ciclo correcto

- **WHEN** se ejecuta la verificación con una base que contiene datos
- **THEN** termina correctamente e informa cuántas tablas y filas se restauraron

#### Scenario: Respaldo corrupto

- **WHEN** se ejecuta la verificación sobre un archivo de respaldo alterado o truncado
- **THEN** falla e indica que el respaldo no es restaurable, sin dejar la base de prueba a medio restaurar

#### Scenario: La verificación no toca la base de origen

- **WHEN** se ejecuta la verificación
- **THEN** la base de origen queda sin modificar, y la base desechable se elimina al terminar, también si la verificación falla

### Requirement: La restauración exige confirmación explícita del destino

La restauración SHALL recibir el nombre de la base de destino de forma explícita y NO SHALL tener un destino por defecto.

Restaurar sobre la base equivocada destruye datos vivos, y ocurriría en el peor momento posible: durante una recuperación, con prisa y con alguien nervioso al teclado.

#### Scenario: Restauración sin destino indicado

- **WHEN** se lanza la restauración sin indicar la base de destino
- **THEN** el proceso se detiene y explica qué falta, sin tocar ninguna base

#### Scenario: Restauración sobre una base con datos

- **WHEN** se lanza la restauración sobre una base que ya contiene datos
- **THEN** el proceso exige una confirmación adicional antes de sobrescribir

### Requirement: El procedimiento de recuperación está escrito y ha sido ejecutado

SHALL existir un procedimiento de recuperación ante desastre que cubra: dónde están los respaldos, cómo se obtiene la clave privada, cómo se restaura sobre un servidor nuevo, y cuánto se pierde en el peor caso.

El procedimiento SHALL registrar la **fecha de la última vez que se ejecutó de verdad**. Un procedimiento escrito y nunca probado es una suposición con formato de documento.

#### Scenario: Alguien tiene que restaurar y no escribió el sistema

- **WHEN** una persona que no participó en la construcción sigue el procedimiento
- **THEN** puede llegar de un archivo cifrado a una base restaurada sin necesitar información que no esté en el documento

#### Scenario: Límite de pérdida declarado

- **WHEN** se consulta el procedimiento
- **THEN** declara explícitamente cuánta información se pierde en el peor caso, y que no existe recuperación a un punto intermedio del día
