# Módulo de clientes

**Semana del plan:** **S10 — CRM + seguimiento** *(el plan la nombra así; la nomenclatura vigente del proyecto es "Módulo de clientes", ver abajo)*.

**HUs:** **CLI_HU001** (vista y resumen), **CLI_HU002** (perfil lateral), **CLI_HU003** (crear manual), **CLI_HU004** (editar). Espejo en `../hus-clientes.md` y tablero Notion "Kora Project". Al cerrar, sincronizar ambos lados.

## Why

**Los clientes ya existen; lo que no existe es la pantalla.** `createOrder()` crea o reconoce un cliente en cada compra —match silencioso por email y teléfono en E.164— y la tabla lleva llenándose desde que la tienda genera pedidos. Hoy esa información **solo se puede consultar entrando a la base de datos**.

Se hace ahora por tres razones que se juntan:

1. **El worker de eventos acaba de existir.** Todas las métricas de esta pantalla cuentan **únicamente pedidos confirmados**, y hasta ayer `order.confirmed` se emitía sin que nadie lo consumiera. Antes del worker, cualquier número aquí habría sido una promesa a medias.
2. **Es donde vivirá el saldo de Kora Cashback.** Construir la pantalla ahora, con el bloque de saldo mostrando cero —como la propia HU exige mientras el módulo no esté activo—, deja el hueco listo para cuando el cliente responda las dos preguntas que aún bloquean el cashback. Al revés no funciona: el cashback necesita esta pantalla, esta pantalla no necesita el cashback.
3. **Es la primera vista que le da valor al operador sobre lo ya vendido.** Todo lo construido hasta hoy sirve para *vender*; esta es la primera que sirve para *entender a quién le vendiste*.

## What Changes

- **Vista "Clientes"** con 4 tarjetas de resumen, buscador y listado paginado, ambos resueltos en servidor.
- **Perfil del cliente** en panel lateral de solo lectura: contacto, distintivo de cuenta, tres métricas, saldo de fidelización, contacto por WhatsApp y top 5 de categorías compradas.
- **Crear y editar clientes** a mano, con el teléfono como identificador único.
- **Se renombra el permiso `crm` a `customers`** — ver abajo. **BREAKING** para la matriz de permisos: exige migración de las filas existentes y actualizar las pruebas que la fijan.
- **Se corrige el enlace de WhatsApp** que la HU especifica mal — ver abajo.

## Dos conflictos que este change resuelve en vez de arrastrar

### El permiso se llama `crm`, y la nomenclatura del proyecto lo prohíbe

La matriz del seed declara `crm: ["view", "create", "edit", "export"]`, hay un `src/modules/crm/` vacío y la navegación del panel lo referencia. Pero la nomenclatura cerrada del proyecto —acuerdo del 18 jul con el cliente— dice que **nunca se llama CRM**: un CRM implica un alcance mucho mayor del que se vendió, y usar la palabra crea una expectativa que el producto no va a cumplir.

Se renombra a `customers` **ahora**, que es el único momento barato: el módulo todavía no existe, ningún rol de producción tiene el permiso asignado y no hay datos colgando de ese nombre. Hacerlo después significa migrar permisos de usuarios reales.

### La HU pide `wa.me`, y la regla 3 lo prohíbe

CLI_HU002 especifica que el botón de contacto abra `wa.me/<teléfono>`. **No se va a implementar así.** La redirección de `wa.me` re-codifica el texto y rompe los caracteres de 4 bytes: el emoji del saludo del mensaje de pedido llegaba partido, y por eso todo el proyecto usa `api.whatsapp.com/send`.

Gana la regla. Queda escrito en la especificación para que nadie lo "corrija" de vuelta leyendo la HU — que es exactamente cómo vuelven los errores ya resueltos.

## Capabilities

### New Capabilities

- `customer-directory`: la vista de clientes — resumen del estado de la base, búsqueda y listado, todo calculado sobre pedidos confirmados y resuelto en servidor.
- `customer-profile`: la ficha de un cliente — quién es, cuánto y qué compra, y cómo contactarlo.
- `customer-management`: alta y edición manual, con el teléfono como identificador único y qué ocurre cuando ese identificador cambia o colisiona.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado. El renombrado del permiso se especifica dentro de `customer-directory`, que es quien lo usa.

## Fuera de alcance

- **Importación masiva de la base existente.** Es un compromiso del DoD de S10, pero merece su propio change: implica formato de archivo, validación previa y escritura todo-o-nada, igual que el importador de catálogo. Meterlo aquí duplicaría el tamaño de este change y retrasaría la pantalla, que es lo que desbloquea al resto.
- **Acreditación de Kora Cashback.** Sigue bloqueada por dos preguntas al cliente (plazo de la ventana de cambios y si pagar con cashback genera cashback). Aquí solo se deja el bloque que muestra el saldo.
- **Historial detallado de pedidos del cliente.** La HU lo excluye explícitamente.
- **Segmentación y envío de campañas** (módulo EML, S13).
- **Eliminar clientes.** No es un olvido: la HU dice que **no existe** esa acción. El histórico es permanente porque alimenta remarketing y fidelización.

## Bloqueos declarados

**Ninguno.** Las decisiones del cliente que esta pantalla necesita están tomadas desde el 18 jul (cuarta tarjeta = "Clientes con cuenta", sin "Tipo de cliente", sin eliminar). El saldo de fidelización se muestra en cero mientras el cashback no exista, que es lo que la propia HU pide.

## Impact

**Archivos nuevos**
- `src/modules/customers/` — consultas agregadas, acciones y validación
- `src/app/admin/clientes/` — la vista y sus paneles laterales
- `tests/customers.test.ts` — unicidad del teléfono, métricas solo sobre confirmados, colisión al editar

**Archivos modificados**
- `prisma/seed.ts` — la matriz de permisos pasa de `crm` a `customers`
- **Migración** que renombra las filas de permisos existentes
- `tests/rbac.test.ts` — fija la matriz, así que cambia con ella
- `src/app/admin/nav-links.tsx` — entrada de navegación
- `src/modules/README.md` y `src/modules/crm/` → `src/modules/customers/`

**Sin impacto**
- No toca inventario, ni precios, ni estados de pedido. Este módulo **lee**; lo único que escribe son los datos de contacto del propio cliente.

**Riesgo principal**
Las métricas son la razón de ser de la pantalla, y una métrica equivocada es peor que ninguna: nadie duda de un número que se ve razonable. Por eso las reglas de cálculo —solo pedidos confirmados, moneda predominante, empates en el top de categorías— se fijan con pruebas y no con revisión visual.
