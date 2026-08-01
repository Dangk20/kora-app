## Purpose

Garantiza que lo que el dashboard muestra corresponde a ventas que de verdad ocurrieron, y que la ausencia de datos se distinga de un cero real.

## ADDED Requirements

### Requirement: Las métricas cuentan solo pedidos confirmados

Toda cifra de ventas del dashboard SHALL contar únicamente pedidos confirmados, con la **misma definición** que usa el resto del panel: un pedido que avanzó más allá de confirmado sigue contando; uno pendiente o cancelado, no.

**Invariante:** dos definiciones de "venta" en el mismo panel es cómo aparecen dos números distintos para la misma cosa, sin que nadie sepa cuál creer. Y si la gráfica sumara pendientes, el operador vería ventas que no ocurrieron y decidiría sobre ellas.

#### Scenario: Pedido pendiente

- **WHEN** existe un pedido creado y sin confirmar
- **THEN** no aparece en la gráfica semanal ni en el top de productos

#### Scenario: Pedido cancelado

- **WHEN** un pedido se cancela
- **THEN** deja de contar en las métricas

#### Scenario: Pedido entregado

- **WHEN** un pedido avanzó hasta entregado
- **THEN** sigue contando como venta

### Requirement: Ventas de los últimos siete días

La gráfica SHALL mostrar el total vendido en cada uno de los últimos siete días, en la moneda principal del negocio, señalando el día actual.

Un día sin ventas SHALL mostrarse como cero **explícito**, no como ausencia.

#### Scenario: Semana con ventas

- **WHEN** hay pedidos confirmados en varios de los últimos siete días
- **THEN** cada día muestra su total y la escala se ajusta al día de mayor venta

#### Scenario: Semana sin ninguna venta

- **WHEN** no hay pedidos confirmados en los últimos siete días
- **THEN** los siete días muestran cero, sin error y sin barras desproporcionadas

### Requirement: El top de productos ordena por ventas reales

El listado SHALL ordenarse por **unidades vendidas** en pedidos confirmados, de mayor a menor. NO SHALL ordenarse por si el producto está destacado ni por su fecha de creación.

**Invariante:** "destacado" es una decisión del operador, no un dato. Un top que ordena por decisiones propias no informa de nada: le devuelve al operador lo que él mismo eligió.

#### Scenario: Productos con ventas

- **WHEN** varios productos tienen ventas confirmadas
- **THEN** aparecen ordenados por unidades vendidas, con su cantidad

#### Scenario: Sin ventas todavía

- **WHEN** ningún producto tiene ventas confirmadas
- **THEN** se muestra un estado vacío que lo dice, en lugar de una lista ordenada por otro criterio
