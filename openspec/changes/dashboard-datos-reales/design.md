# Diseño — dashboard con datos reales

## Context

Motivación en `proposal.md`. Requisitos en `specs/`.

Las tarjetas superiores del dashboard **ya consultan datos reales** y no se tocan. Lo que miente es la gráfica semanal —barras en cero con una leyenda de cuando la tienda no vendía— y el top de productos, ordenado por `featured` y fecha.

El módulo de clientes dejó construido el predicado único de "pedido confirmado". Aquí se reutiliza: es lo que impide que el dashboard y el perfil del cliente muestren números distintos para la misma venta.

## Goals / Non-Goals

**Goals**
- Que ninguna cifra del dashboard incluya pedidos que no son ventas.
- Que un día sin ventas se lea como cero y no como fallo.

**Non-Goals**
- Informes, filtros por rango y comparativas: son el grueso de S11 y necesitan HUs escritas.
- Caché de métricas. Se calculan en cada carga, como el resto del panel.

## Decisions

### 1. Se reutiliza el predicado de "confirmado" del módulo de clientes

**Decisión:** importar la definición existente en vez de escribir otro filtro.

**Por qué:** es exactamente el error que ese módulo previno para sí mismo. Un filtro propio aquí bastaría con olvidar un estado para que el dashboard y el perfil del cliente discrepen — y ambos números parecerían razonables.

### 2. Las dos agregaciones se resuelven en la base

**Decisión:** ventas por día y unidades por producto se agrupan en SQL.

**Por qué:** traer los pedidos de siete días y sus líneas para sumarlos en la aplicación funciona hoy y deja de funcionar con volumen. Es el mismo criterio del módulo de clientes.

### 3. La gráfica cubre siete días fijos, incluidos los vacíos

**Decisión:** se construyen siempre siete casillas, rellenando con cero los días sin ventas.

**Por qué:** si se pintaran solo los días con datos, una semana con dos ventas mostraría dos barras y el operador leería una semana de dos días. El cero explícito es información: dice que ese día no se vendió.

### 4. Una sola moneda en la gráfica

**Decisión:** la gráfica muestra la moneda principal del negocio y no mezcla.

**Por qué:** no hay tasa de cambio en KORA y es deliberado. Sumar pesos y dólares en una barra daría una altura sin significado.

## Dónde vive cada cosa

```
src/modules/dashboard/queries.ts   ventas por día y top de productos
src/app/admin/page.tsx             (modificado) consume lo anterior
tests/dashboard.test.ts
```

Sin migración de esquema. No emite ni consume eventos.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un número plausible no levanta sospechas.** | Se reutiliza el predicado de confirmado y se fija con prueba que pendientes y cancelados no entran. |
| **La gráfica crece con el histórico.** | Ventana fija de siete días, agregada en la base. |
| **Sin ventas, la gráfica parece rota.** | Los siete días se pintan siempre; el vacío se lee como cero. |

## Migration Plan

1. Consultas con sus pruebas.
2. Sustituir la gráfica falsa y el top.
3. Verificar contra los pedidos reales de la base.

**Reversión:** la pantalla anterior no se pierde; volver es restaurar dos bloques.
