# Diseño — Módulo de ventas

## Context

Motivación en `proposal.md`. Requisitos en `specs/sales-reporting/`.

**Lo que ya existe y hay que reutilizar, no reescribir:**

- **`CONFIRMED_STATUSES`** (`modules/customers/confirmed.ts`) ya es la única definición de "pedido confirmado" del proyecto, y nació exactamente por este motivo: seis sitios filtraban lo mismo y bastaba que uno se equivocara para que dos cifras se contradijeran.
- **El pedido guarda su total ya neto** de cupón y de cashback. Es lo que el operador cobró.
- **`confirmedAt`** ya se escribe en `confirmOrder()`.
- **El canal** (`SaleChannel`: WEB / POS) ya está en el pedido desde el primer día.
- **`salesLastWeek()`** ya filtra por moneda correctamente — es el modelo a seguir, y la prueba de que el resto no lo hace.

**El defecto que se corrige:** las tarjetas de `src/app/admin/page.tsx` agregan `_sum: { total }` **sin filtrar moneda** y lo formatean con `formatCop()`. `topProducts()` hace lo mismo con su columna de ingresos.

## Goals / Non-Goals

**Goals**

- Que el operador cierre su mes con cifras que no mientan.
- Que "venta" signifique lo mismo en las tres pantallas que la muestran.
- Que el POS solo tenga que empezar a escribir ventas para aparecer aquí.

**Non-Goals**

- Informes analíticos, gráficas nuevas, devoluciones.
- Guardar las ventas en una tabla propia (ver decisión 1).

## Decisions

### 1. La venta se DERIVA del pedido; no hay tabla de ventas

**Decisión:** el módulo consulta `orders` filtrando por estado confirmado. No se crea una tabla `sales` ni se copia nada.

**Por qué:** una tabla aparte sería una segunda copia de un dato que ya existe, con la obligación de mantenerla sincronizada en cada confirmación, cancelación y avance de estado. El día que se desincronice, el módulo de ventas y el pedido dirán cosas distintas sobre el mismo dinero — y no habría forma de saber cuál miente.

Es la misma decisión que ya se tomó con el estado de los cupones y con el cashback pendiente: **lo que se puede derivar no se guarda**.

**Coste aceptado:** consultas con `JOIN` y agregación en cada carga. Con el volumen de una tienda que cobra por WhatsApp, es irrelevante; y hay índice por `(status, createdAt)`. Si algún día pesara, la salida es una vista materializada, no una copia editable a mano.

### 2. Los totales se agrupan POR MONEDA en la consulta, no al pintar

**Decisión:** las consultas devuelven `[{ currency, ventas, total, ticket }, …]` — una fila por moneda. La pantalla itera; no suma.

**Por qué:** si la consulta devolviera un total plano y la pantalla lo separara, el primer sitio que reutilice esa consulta sin acordarse volvería a mezclar. Devolviendo la moneda ya separada, **mezclar exige una decisión explícita** en vez de ser lo que pasa por omisión. Es la misma razón por la que el saldo de cashback es un tipo con dos bolsas y no un número.

### 3. El dashboard elige moneda, con selector PROPIO en la dirección

**Decisión:** las cuatro tarjetas, la gráfica semanal y el top de productos responden a una moneda elegida en la dirección (`?moneda=USD`), por omisión pesos. La moneda queda escrita en pantalla.

**Por qué mostrar una y no las dos:** son tarjetas de un vistazo. Duplicarlas a ocho convierte la primera pantalla del panel en una hoja de cálculo, y el operador colombiano mira pesos casi siempre. Quien necesite las dos juntas tiene el módulo de ventas, que las muestra separadas.

**Por qué un selector propio y NO la moneda activa de la tienda:** esa cookie es del comprador y la pone el selector de la tienda. Si el panel la leyera, un operador que entrara a la tienda a revisar un producto en dólares volvería al dashboard y encontraría otras cifras sin haber pedido nada. Son dos preguntas distintas —"¿en qué moneda compro?" y "¿qué facturación miro?"— y compartir el estado las confunde.

En la dirección, además, como el resto de filtros del panel: es enlazable y sobrevive a recargar.

**Coste aceptado:** para ver las ventas en dólares hay que cambiar de moneda. Es un clic, y quien necesita las dos a la vez tiene el módulo de ventas, que las muestra juntas y separadas.

### 4. La fecha es `confirmedAt`, y por eso el listado no puede ordenar por creación

**Decisión:** todo el módulo —filtro, orden y agrupación— usa `confirmedAt`.

**Por qué:** el pedido se arma cuando el comprador quiere y se confirma cuando el operador cobra. Fechar por creación metería dinero en un mes en el que no entró y el cierre dejaría de cuadrar con la caja.

**Consecuencia:** un pedido confirmado siempre tiene `confirmedAt`; si alguno no lo tuviera sería un dato roto, y la consulta lo dejaría fuera en vez de inventarle una fecha.

### 5. La exportación se genera en el servidor y se descarga

**Decisión:** CSV con `;` como separador y BOM UTF-8, servido por una ruta que exige `sales:export`.

**Por qué:** el CSV lo abre cualquier hoja de cálculo sin instalar nada. El punto y coma y el BOM son por Excel en español: con coma, Excel en configuración regional colombiana mete todo en una columna; sin BOM, se comen las tildes. Son dos detalles que deciden si el archivo es usable o si el operador nos escribe.

Los importes van **sin símbolo ni separador de miles**, y la moneda en columna aparte: si no, la hoja no puede sumar.

### 6. Permiso propio `sales`, no reutilizar `orders:view`

**Decisión:** `sales:view` y `sales:export`, con `sales:view` para admin, operador y marketing; `sales:export` solo para admin.

**Por qué:** ver pedidos y ver la facturación del negocio no son lo mismo. El cajero necesita lo primero para atender y no tiene por qué saber cuánto factura la empresa. Y exportar es sacar los datos del sistema: merece su propio permiso, igual que se hizo con `customers:export`.

## Dónde vive cada cosa

```
src/modules/sales/
  definition.ts   qué es una venta y de qué fecha — reexporta CONFIRMED_STATUSES
  queries.ts      listado paginado y totales por moneda
  csv.ts          la exportación
src/app/admin/ventas/
  page.tsx        pantalla + filtros por URL
  export/route.ts la descarga
tests/sales.test.ts
```

**Migración de Prisma:** **ninguna.** Todo se deriva de datos que ya existen. Solo cambia el seed, que añade el permiso.

**Pantallas modificadas:** las tarjetas del dashboard y el menú del panel.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Volver a mezclar monedas** en alguna cifra nueva. Es el defecto que este change corrige. | Las consultas devuelven la moneda ya separada: mezclar exige decidirlo. Fijado por prueba, incluida una que comprueba que un pedido en dólares **no** altera el total en pesos. |
| **Que "venta" se desincronice** entre el módulo, el dashboard y clientes. | Los tres usan `CONFIRMED_STATUSES`; una prueba compara el total del módulo con el del dashboard para el mismo periodo. |
| **El cliente ve cifras distintas de las de ayer** y cree que se rompió algo. | Es lo esperado: las de ayer estaban mal. Hay que decírselo al entregar, no dejar que lo descubra. Queda anotado. |
| **La exportación con muchas ventas** carga todo en memoria. | Con el volumen real es irrelevante. Se acota el rango máximo exportable y se dice en pantalla, en vez de fallar en silencio. |
| **Un pedido confirmado sin `confirmedAt`** quedaría fuera de las ventas. | Sería un dato roto, no un caso de negocio; la verificación del libro de inventario ya vigila esa clase de cosas. Se prefiere excluirlo a inventarle fecha. |

## Migration Plan

1. Permiso `sales` en la matriz y en los roles.
2. `definition.ts` y `queries.ts` **con sus pruebas, antes de la pantalla**.
3. Corregir el dashboard — es el defecto vivo, va primero que la pantalla nueva.
4. Pantalla de ventas con sus filtros.
5. Exportación.

**Reversión:** quitar el enlace del menú deja el panel como está hoy, salvo el dashboard, cuya corrección no se revierte: hoy miente.

## Open Questions

- **¿Qué considera el cliente "el cierre del mes"?** Se asume mes calendario. Si su contabilidad cierra otro día, el periodo por defecto cambia — pero el filtro por rango lo cubre igual.
- **¿Quiere ver las ventas anuladas por separado?** Hoy simplemente no aparecen. Saber cuántas se cayeron después de confirmarse es un dato de negocio útil, pero no está pedido.
