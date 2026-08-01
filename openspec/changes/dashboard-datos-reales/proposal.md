# Dashboard con datos reales

**Semana del plan:** **S11 — Dashboard + informes**, parcialmente.

**HUs asociadas:** **ninguna.** El área de dashboard (DSH) no tiene historias de usuario escritas todavía — está en la lista de pendientes del backlog. No se inventa ninguna: este change corrige datos falsos en una pantalla que ya existe, no define el informe completo.

## Why

El dashboard es **la primera pantalla que ve el operador al entrar**, y hoy tiene dos cosas que no son ciertas:

1. **La gráfica "Ventas de la semana" muestra todas las barras en cero**, con la leyenda *"Las ventas llegan con los pedidos (Semana 8)"*. Esa semana ya pasó: hay pedidos reales confirmados en la base. La leyenda es de cuando la tienda no vendía.
2. **El "top de productos" no ordena por ventas**, sino por destacado y fecha de creación. Es decir: no es un top de nada — muestra lo que el operador marcó como destacado, que es una decisión suya, no un dato.

Las tarjetas superiores (ventas de hoy, del mes, pendientes, ticket, stock bajo) **sí** consultan datos reales y no se tocan.

Se corrige ahora porque **una pantalla que miente es peor que una vacía**: un cero en una gráfica se lee como "no vendimos", no como "esto todavía no está conectado". Y porque el trabajo pesado ya está hecho — el módulo de clientes dejó construidas las agregaciones sobre pedidos confirmados.

## What Changes

- **Gráfica semanal con ventas reales** de los últimos siete días, contando solo pedidos confirmados.
- **Top de productos por unidades realmente vendidas**, no por destacado.
- **Se retira la leyenda** que anuncia que las ventas llegarán en la Semana 8.

## Capabilities

### New Capabilities

- `dashboard-metrics`: que lo que el dashboard muestra corresponda a ventas ocurridas, y que la ausencia de datos se distinga de un cero real.

### Modified Capabilities

Ninguna capacidad publicada cambia.

## Fuera de alcance

- **Informes exportables y filtros por rango**, que son el grueso de S11 y necesitan HUs escritas antes.
- **Métricas por cupón** (excluidas por CUP_HU001) y **métricas de clientes**, que ya tienen su propia pantalla.
- **Comparativas contra periodos anteriores.**

## Bloqueos declarados

Ninguno.

## Impact

**Nuevo:** `src/modules/dashboard/queries.ts` con las agregaciones y `tests/dashboard.test.ts`.
**Modificado:** `src/app/admin/page.tsx`.

**Regla que no se puede violar:** las métricas cuentan **solo pedidos confirmados**, con la misma definición que usa el módulo de clientes. Dos definiciones de "venta" en el mismo panel es cómo aparecen dos números distintos para la misma cosa.

**Riesgo principal**
Un número plausible no levanta sospechas. Si la gráfica sumara pedidos pendientes, el operador vería ventas que no ocurrieron y tomaría decisiones sobre ellas.
