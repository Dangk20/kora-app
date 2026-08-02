# Módulo de ventas y monedas separadas en el dashboard

**Semana del plan:** **S11**, la mitad que el plan nombra "Dashboard + informes". El dashboard ya lee datos reales; falta el registro de ventas y falta que las cifras no mientan.

**HUs:** **no existen.** No hay `hus-ventas.md` ni historias del área DSH. La fuente de requisitos es el **alcance firmado**, §2.4:

> *"**Gestión de ventas** — Registro y consulta de ventas realizadas (online y POS)."*

Se dice en vez de trazar contra una historia inventada. Queda pendiente escribirlas.

## Why

**Está cotizado y no existe.** Hay `/admin/pedidos` y el dashboard, y ninguno de los dos es esto. **Un pedido no es una venta:** uno pendiente todavía no vendió nada, uno cancelado dejó de venderlo, y en el POS la venta nace ya confirmada. Hoy nadie puede responder *"¿cuánto vendí en julio, por canal, y me lo llevo a Excel?"* sin abrir la base de datos.

**Y el dashboard está mintiendo.** Las cuatro tarjetas de arriba —*Ventas hoy*, *Ventas del mes*, *Ticket promedio*— **suman pesos y dólares en el mismo número y lo imprimen todo como COP**. Un pedido de USD 40 entra como si fueran $40 pesos. `topProducts` hace lo mismo en su columna de ingresos.

No es un detalle: es la regla que este proyecto tiene prohibida —**las monedas nunca se mezclan**— y el error es del tipo que **parece correcto**. Se coló porque el trabajo anterior arregló la gráfica semanal y el orden del top, pero nunca tocó las tarjetas. Con catálogo real y ventas en las dos monedas, el cliente vería cifras falsas desde el primer día y tomaría decisiones con ellas.

Se hace ahora porque es requisito del bloque **"KORA Tienda Online v1"**: el operador tiene que poder cerrar su mes.

## What Changes

- **Módulo de ventas** (`/admin/ventas`): las ventas realizadas, con filtro por rango de fechas, canal y moneda; totales **por moneda**; y **exportación** a CSV.
- **BREAKING de comportamiento — el dashboard deja de sumar monedas.** Las tarjetas pasan a mostrar la cifra de **la moneda activa**, no un total mezclado. Los números que el operador vea hoy y mañana serán distintos: los de hoy están mal.
- **Permiso propio `sales:view` y `sales:export`**, con su sitio en la matriz de roles.
- **Una sola definición de "venta"** para el módulo, el dashboard y el módulo de clientes.

## Capabilities

### New Capabilities

- `sales-reporting`: qué cuenta como venta, cómo se consulta y por qué los totales nunca mezclan monedas.

### Modified Capabilities

Ninguna capacidad publicada cambia. `openspec/specs/` contiene las tres del correo (`email-campaigns`, `email-consent`, `email-delivery`), que este change no toca.

## Fuera de alcance

- **El canal POS.** El módulo se construye con el canal como filtro de primera clase y el POS aparecerá solo cuando exista (S9); hoy no hay ventas presenciales que listar.
- **Informes exportables por producto, categoría o cliente.** El alcance §2.4 pide "registro y consulta"; los informes analíticos son otra cosa y no tienen HUs escritas. Se entrega la exportación de las ventas, que es lo que permite armar cualquier informe en una hoja de cálculo.
- **Gráficas nuevas en el dashboard.** Aquí solo se corrige lo que miente.
- **Devoluciones y notas de crédito.** KORA no devuelve dinero (regla del cliente): solo cambia productos, y el cambio no altera el registro de la venta original.

## Bloqueos declarados

**Ninguno.**

## Impact

**Archivos nuevos**
- `src/modules/sales/` — la definición de venta, las consultas y la exportación
- `src/app/admin/ventas/` — la pantalla
- `tests/sales.test.ts`

**Archivos modificados**
- `prisma/seed.ts` — el permiso `sales` en la matriz y en los roles
- `src/app/admin/page.tsx` — las tarjetas dejan de mezclar monedas
- `src/modules/dashboard/queries.ts` — `topProducts` filtra por moneda
- El menú del panel

**Reglas del proyecto que este change NO puede violar**
- **Las dos monedas nunca se suman ni se convierten.** Es literalmente el defecto que este change viene a corregir; volver a cometerlo aquí sería el peor sitio.
- **Toda pantalla protegida usa `requirePermission()`** contra la base.
- **La lógica vive en `src/modules/sales/`**; la ruta es delgada.

**Riesgo principal**
Que "venta" signifique una cosa aquí y otra en el dashboard o en el módulo de clientes. Ya existe `CONFIRMED_STATUSES` como única definición de pedido confirmado y este módulo **la reutiliza en vez de escribir su propio filtro**: si cada pantalla definiera lo suyo, bastaría con que una olvidara excluir los cancelados para que dos cifras del mismo panel se contradijeran — y ninguna parecería equivocada.
