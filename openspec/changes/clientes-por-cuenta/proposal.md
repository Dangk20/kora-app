## Why

**Módulo de clientes (CLI_HU001) — ajuste pedido por Daniel el 17 oct 2026.** Reemplaza la etiqueta Cliente / No cliente del change `clientes-registrados` (11 oct). Con la caja guardando clientes que nunca se registran en la web, lo que el operador necesita distinguir es **quién tiene cuenta** en la tienda. Si alguien compró o no se ve en su ficha (pedidos, top de categorías y días de compra).

## What Changes

- Todos son **clientes**. Indicadores: **Total de registros**, **Clientes con cuenta** y **Clientes sin cuenta**.
- Insignia por fila: **Con cuenta / Sin cuenta** (antes "Invitado"); debajo del nombre, el **origen** (tienda web, caja, importado, a mano).
- Filtro **Todos / Con cuenta / Sin cuenta** (parámetro `cuenta`), en lugar de Clientes / No clientes.
- La clasificación **no se guarda**: se deriva de la contraseña (`passwordHash`). No hay columna "rol": ese nombre ya es de los roles de acceso al panel.

## Capabilities

### Modified Capabilities
- `customer-directory`: indicadores, insignia y filtro por cuenta.

## Impact

Sin migración. `src/modules/customers/cuenta.ts` (nuevo; sale `etiqueta.ts`), `queries.ts`, `admin/clientes/page.tsx`, `customer-sheet.tsx`, `tests/clientes-registrados.test.ts`. El segmento "sin compras" de campañas no cambia: calcula sus propios datos.

## Fuera de alcance

Columna de cantidad de compras en el listado (se ve en la ficha); estados de cliente guardados en la base.
