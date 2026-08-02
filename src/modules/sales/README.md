# Ventas

El registro de lo que se vendió. Alcance §2.4: *"Registro y consulta de ventas
realizadas (online y POS)"*.
Requisitos: `openspec/changes/modulo-ventas/specs/sales-reporting/`.

## Un pedido no es una venta

Uno **pendiente** todavía no vendió nada. Uno **cancelado** dejó de venderlo.
Uno **entregado** sigue siendo una venta. En el POS la venta nace ya confirmada.

Por eso este módulo existe aparte de `/admin/pedidos`: son dos preguntas
distintas. Pedidos es trabajo por hacer; ventas es dinero que entró. Y por eso
tienen permisos distintos — el cajero necesita lo primero y no tiene por qué
saber cuánto factura el negocio.

## Las tres reglas que no se negocian

**Las monedas NUNCA se suman.** `salesTotals()` devuelve **una fila por moneda**,
nunca un total plano. Si devolviera uno y la pantalla lo separara, el primer
sitio que reutilizara la consulta sin acordarse volvería a mezclar. Así,
sumarlas exige una decisión explícita.

Es el defecto que este módulo vino a corregir: el dashboard sumaba pesos y
dólares y lo imprimía todo como pesos. Un pedido de USD 40 entraba como $40.

**"Venta" se define UNA vez.** Se reutiliza `CONFIRMED_STATUSES` del módulo de
clientes. Si cada pantalla escribiera su filtro, bastaría que una olvidara
excluir los cancelados para que dos cifras del mismo panel se contradijeran — y
ninguna parecería equivocada.

**La fecha es la de CONFIRMACIÓN**, y en días de Colombia (ver
`@/lib/business-time`). El pedido se arma cuando el comprador quiere y se
confirma cuando el operador cobra; y el servidor corre en UTC, cinco horas
adelante. Sin las dos reglas, el dinero cae en el día —o el mes— equivocado.

## La venta se deriva, no se guarda

No hay tabla `sales`. Sería una segunda copia de un dato que ya existe, con la
obligación de mantenerla al día en cada confirmación, cancelación y avance de
estado; el día que se desincronizara, el módulo y el pedido dirían cosas
distintas sobre el mismo dinero sin forma de saber cuál miente.

Misma decisión que el estado de los cupones y el cashback pendiente: **lo que se
puede derivar no se guarda**.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `definition.ts` | Qué es una venta, de qué fecha y el periodo por defecto |
| `queries.ts` | Totales por moneda y listado paginado |
| `csv.ts` | Exportación para hoja de cálculo |

## La exportación

CSV con `;` y BOM UTF-8 — no es capricho: Excel en español con `,` mete la fila
en una columna, y sin BOM se come las tildes en los nombres de los clientes.
Los importes van **sin símbolo ni separador de miles** y la moneda en columna
propia, o la hoja no puede sumar.

Exige `sales:export`, aparte de `sales:view`: exportar es sacar los datos del
negocio del sistema.

## Lo que no está

- **El canal POS**, hasta que el POS exista. El filtro ya está puesto: cuando
  llegue, solo tiene que empezar a escribir sus ventas.
- **Informes analíticos** por producto, categoría o cliente. El alcance pide
  "registro y consulta"; exportar cubre cualquier informe que el negocio arme.
- **Devoluciones.** KORA no devuelve dinero: solo cambia productos, y el cambio
  no altera el registro de la venta original.
