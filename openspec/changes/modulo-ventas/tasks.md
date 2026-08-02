## 1. Permiso

- [x] 1.1 Añadir el módulo `sales` con las acciones `view` y `export` a la matriz del seed; `sales:view` para admin, operador y marketing, `sales:export` solo para admin.
- [x] 1.2 Fijar en `tests/rbac.test.ts` que el cajero **no** tiene `sales:view` y que el operador **no** tiene `sales:export`.

## 2. Qué es una venta

- [x] 2.1 `src/modules/sales/definition.ts`: la definición de venta reutilizando `CONFIRMED_STATUSES` —sin escribir un filtro propio— y la regla de que la fecha es `confirmedAt`, no la de creación.
- [x] 2.2 `src/modules/sales/queries.ts` — `salesTotals()`: devuelve **una fila por moneda** con número de ventas, total y ticket promedio. Nunca un total plano.
- [x] 2.3 `queries.ts` — `listSales()`: listado paginado con filtro por rango, canal y moneda, ordenado por fecha de confirmación, con el cliente y el número de pedido.

## 3. Pruebas de la definición y los totales

- [x] 3.1 Un pedido pendiente no cuenta; uno cancelado tras confirmarse deja de contar; uno entregado sigue contando **una sola vez**.
- [x] 3.2 **Un pedido en dólares NO altera el total en pesos**: los totales llegan separados por moneda.
- [x] 3.3 Un pedido creado el último día del mes y confirmado el primero del siguiente cuenta en el mes de la confirmación.
- [x] 3.4 El total del módulo **coincide** con el del dashboard para el mismo periodo y moneda.
- [x] 3.5 El total de una venta con cupón y cashback es el efectivamente cobrado, no el precio de lista.

## 4. El dashboard deja de mentir

- [x] 4.0 **Hallazgo durante la implementación:** la gráfica agrupaba por días **UTC** y rotulaba en días de Colombia, así que una venta de la mañana aparecía en el día anterior y las tarjetas de "hoy"/"del mes" empezaban a contar a las 7 p.m. del día previo. Extraer la regla del día del negocio —que ya existía en la numeración del pedido— a `src/lib/business-time.ts` y aplicarla a la gráfica, a las tarjetas y a los periodos. Ojo: `confirmedAt` es `timestamp` **sin zona** con el valor en UTC, así que hay que declararlo UTC **antes** de pedirlo en Bogotá; un solo `AT TIME ZONE` desplaza los días al lado contrario sin que nada falle.
- [x] 4.1 Las tarjetas *Ventas hoy*, *Ventas del mes* y *Ticket promedio* pasan a filtrar por la **moneda activa** y a formatearse en ella; la moneda queda visible en pantalla.
- [x] 4.2 `topProducts()` filtra por moneda en su columna de ingresos.
- [x] 4.3 Prueba: con ventas en las dos monedas, las cifras del dashboard corresponden solo a la moneda pedida.
- [x] 4.4 Prueba del huso: una venta confirmada a las 8 p.m. en Bogotá cuenta en el día colombiano, no en el siguiente; la ventana son siete días del negocio y exactamente uno es hoy.

## 5. La pantalla

- [x] 5.1 `/admin/ventas`: filtros por rango, canal y moneda **en la dirección** (enlazables y sobreviven a recargar), como el resto del panel.
- [x] 5.2 Totales por moneda arriba, sin combinarlos nunca; listado con número, fecha de confirmación, cliente, canal, moneda y total, que abre el pedido.
- [x] 5.3 Periodo por defecto —el mes en curso— dicho en pantalla, no adivinado.
- [x] 5.4 Filtrar por punto de venta explica que todavía no hay ventas presenciales, en vez de una tabla vacía sin motivo.
- [x] 5.5 Enlace en el menú del panel, visible solo con `sales:view`.

## 6. Exportación

- [x] 6.1 `src/modules/sales/csv.ts`: CSV con `;` y BOM UTF-8 (Excel en español), importes **sin símbolo ni separador de miles** y la moneda en columna propia.
- [x] 6.2 Ruta de descarga que exige `sales:export` y respeta los filtros aplicados.
- [x] 6.3 Tope de rango exportable, dicho en pantalla en lugar de fallar en silencio.
- [x] 6.4 Pruebas: el archivo contiene exactamente lo filtrado; los importes son sumables; sin el permiso se rechaza.

## 7. Documentación y cierre

- [x] 7.1 `src/modules/sales/README.md`: por qué la venta se deriva del pedido y por qué los totales llegan separados por moneda.
- [x] 7.2 Actualizar el `CLAUDE.md` de la app y la bitácora de sprints.
- [x] 7.3 Anotar en `../notas-tecnicas-privado.md` que **las cifras del dashboard cambian respecto a las que el cliente pudo ver antes, porque las de antes estaban mal** — hay que decírselo al entregar, no dejar que lo descubra.
- [x] 7.4 Declarar el pendiente de escribir las HUs del área de ventas y llevarlas al tablero (anotado en las notas privadas; **las HUs siguen sin escribir**).
- [x] 7.5 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
