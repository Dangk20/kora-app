# CLAUDE.md — kora-app

E-commerce KORA (venta cerrada, 18 semanas: 11 jul → 13 nov 2026). **Monolito modular** — microservicios/K8s/serverless descartados a propósito. El riesgo del proyecto no es escala: es **correctitud bajo concurrencia** (web y POS compiten por el mismo stock).

Documentos rectores (leer antes de decidir):
- `../plan-tecnico-ejecucion-kora.md` — arquitectura, stack, DoD por semana, riesgos.
- `../bitacora-sprints-kora.md` — **estado real de ejecución** (qué está hecho, qué sigue, deudas). Actualizarla al cerrar cada sesión de trabajo.
- `../../business/hitos-semanales-kora.md` — cronograma cara al cliente (no tocar sin razón).
- Prototipo aprobado: `../design-handoff/Kora.dc.html` + `HANDOFF.md`.

## Metodología de trabajo: OpenSpec (obligatoria desde el 30 jul 2026)

**Nada se construye sin spec.** Cada semana del plan y cada plan de acción se ejecuta como un *change* de OpenSpec (`@fission-ai/openspec`, schema `spec-driven`): se escribe primero **qué** y **por qué**, luego **cómo**, luego se implementa contra esa spec.

Ciclo por cada pieza de trabajo (comandos de Claude Code):

| Paso | Comando | Qué produce |
|---|---|---|
| 1. Proponer | `/opsx:propose "<idea>"` | `proposal.md` (qué y por qué) → `specs/<capacidad>/spec.md` (requisitos verificables) → `design.md` (cómo) → `tasks.md` (pasos) |
| 2. Revisar | `pnpm spec status --change <nombre>` · `pnpm spec show <nombre>` | Estado de artefactos antes de tocar código |
| 3. Implementar | `/opsx:apply` | Código contra las tareas, con evidencia por tarea |
| 4. Ajustar | `/opsx:update` | Cambios de alcance a mitad de camino, en la spec — no en la cabeza |
| 5. Cerrar | `/opsx:archive` | Archiva el change y **actualiza la bitácora de sprints** |

- **Un change por semana del plan o por módulo** (`s06-busqueda-movil`, `outbox-worker`, `modulo-clientes`, …), en kebab-case y en inglés/código; el contenido va en español.
- **El contexto del proyecto vive en `openspec/config.yaml`** — reglas innegociables, nomenclatura, fuente de requisitos y guía por artefacto. Se inyecta automáticamente en cada artefacto que se genera. Si cambia una regla del proyecto, se cambia **ahí** además de aquí.
- **Las HUs siguen siendo la fuente de requisitos** (`../hus-<área>.md` + Notion). Las specs de OpenSpec trazan contra ellas (`PED_HU003`, `CAT_HU001`, …); no las reemplazan ni las duplican.
- El CLI local está fijado en `devDependencies`: `pnpm spec <subcomando>` (equivale a `openspec`). Los comandos y skills versionados viven en `.claude/`; `settings.local.json` no se versiona.
- **`openspec/specs/` ya NO está vacío** (desde el 1 ago 2026, con el archivado de `email-marketing`): ahí viven las capacidades publicadas. Los changes anteriores siguen sin archivar, así que una propuesta nueva debe comprobar el estado real con `pnpm spec list` en vez de repetir la frase "specs sigue vacío", que era cierta hasta esa fecha.

## Stack

Next.js 15 (App Router) + TypeScript · Tailwind 4 + shadcn/ui · PostgreSQL 16 + Prisma 7 (adapter pg, config en `prisma.config.ts`) · Redis (futuro: caché/colas) · Auth.js v5 (JWT 12h) · Vitest · CI en GitHub Actions (`Dangk20/kora-app`).

## Comandos

```bash
pnpm db:up          # Postgres (puerto 5433) + Redis (6380) — puertos no estándar a propósito
pnpm db:migrate     # migraciones (nunca cambios de esquema a mano)
pnpm db:seed        # roles, permisos, admin dev, catálogo demo
pnpm rbac:sync      # aplica la matriz de permisos a la base (lo corre el despliegue)
pnpm dev            # desarrollo · pnpm start = build de producción
pnpm test           # Vitest (integración contra el Postgres local — debe estar arriba)
pnpm typecheck && pnpm lint && pnpm build   # lo que corre el CI
pnpm ledger:verify  # verificación del libro de inventario (corre también en el worker)
pnpm cashback:verify # verificación del libro de Kora Cashback — avisa, no corrige
pnpm staff:email <correo>  # a dónde llegan los avisos de pedido nuevo
pnpm emails:preview        # escribe un ejemplo de cada correo del pedido en .emails/
# Los correos de desarrollo se escriben en .emails/ (ignorado por git)
```

Login dev: `admin@kora.local` / `kora-dev-2026` · cajero: `caja@kora.local` / `caja-dev-2026`.

## Reglas innegociables

1. **`stockActual` y `onlineUnits` SOLO cambian dentro de `src/modules/inventory/engine.ts`** (transacción con `SELECT ... FOR UPDATE` + movimiento en `stock_movements` + materialización). Ni seeds, ni importadores, ni actions se lo saltan. El test de aceptación (50 compras concurrentes sobre stock=1 → exactamente 1 gana) vive en `tests/inventory.test.ts` y no es negociable.
2. **El stock es UN pool.** `onlineUnits` es asignación de canal, no un segundo stock: la web vende hasta su cupo; el POS nunca se bloquea (clamp automático del cupo).
3. **`order.confirmed` será el evento central** (outbox en `domain_events`) — el pago ocurre por WhatsApp, fuera de la plataforma. Decisión cerrada: el stock solo se descuenta al confirmar (sin reserva).
4. **Toda Server Action protegida usa `requirePermission("modulo:accion")`** (verifica contra la BASE, no el JWT — revocación inmediata). La matriz de permisos está fijada por tests (`tests/rbac.test.ts`).
5. **Fidelidad de diseño:** toda pantalla nueva se construye mirando su equivalente en el prototipo aprobado (`Kora.dc.html`) — layout y patrones del prototipo; **color y tipografía del manual de marca** (tokens en `src/app/globals.css`: gradiente `bg-kora-gradient` 135°, neutros kora-*, Manrope/Allura). Botón principal = variant `brand`.
6. **La lógica vive en `src/modules/<dominio>/`** (ver su README); las rutas de `src/app/` son delgadas. Slide-overs controlados por URL (`?nuevo=1`, `?editar=id`, `?ajustar=id`).
7. **La matriz de permisos vive en `prisma/rbac.ts`, NO en el seed**, y el contenedor de migraciones la sincroniza en cada despliegue. El seed solo corre en bases nuevas: cuando la matriz vivía ahí, un permiso añadido **nunca llegaba a un entorno existente** y su módulo quedaba invisible en el menú, sin error. Le pasó a Cupones y a Ventas a la vez en pruebas. Añadir un permiso = tocar esa matriz y desplegar; nada más.
8. Migraciones versionadas siempre; ningún secreto en el repo (`.env` ignorado, plantilla en `.env.example`).

## Estado y pendientes

El detalle vivo está en `../bitacora-sprints-kora.md`. Resumen al 19 jul 2026: **S1–S5 cerradas** (S5 = tienda pública: catálogo, adelantada). Staging bloqueado por accesos SSH/DNS del cliente. 56 tests verdes.

**Importador de catálogo** (`src/modules/catalog/import/`): las columnas del Excel se definen UNA vez en `columns.ts` — plantilla, parser y validación salen de ahí; si cambia una columna, cambia solo ese archivo. La importación valida todo el archivo antes de escribir (todo-o-nada) y el stock inicial entra por `receiveStock()` del motor, nunca por fuera. Un SKU que ya existe actualiza precios pero **jamás** vuelve a sumar stock.

**Almacenamiento** (`src/modules/storage/`): interfaz con dos drivers — disco local en dev (`.uploads/`, servido por `/media/[...key]`, solo dev) y R2 en producción. Se elige por variables de entorno; en producción, sin R2 configurado la app **falla al arrancar** (el VPS nunca sirve imágenes). El tipo de archivo se valida por magic numbers, no por el content-type del navegador.

**Precios** (`src/modules/pricing/`): `resolvePrice()` es la ÚNICA fuente de precio de tienda, carrito, checkout y snapshot del pedido (CAT_HU001 §3). Ninguna vista calcula precios. Reglas que no se negocian: cada divisa usa **su precio cargado** (nunca conversión por tasa), y el tachado + badge "Precio especial online" solo aparecen si el precio online es **realmente menor** que el de tienda en la misma moneda.

**Tienda pública** (`src/app/(tienda)/` + `src/modules/storefront/`): home, `/catalogo`, `/producto/[slug]`, `/carrito` y `/checkout`. "Disponible" = `onlineUnits > 0` (cupo online), no el stock total. Las cards del catálogo **no llevan botón**: la compra se decide en la ficha. No publicar promesas comerciales que el negocio no sostiene (cuotas, compra protegida, envío gratis, devoluciones): ver `../notas-tecnicas-privado.md` §Tienda pública.

**Vitrina** (`src/modules/showcase/` + `src/app/admin/vitrina/`): administra la portada de la tienda. Las secciones son **fijas** (`sections.ts` es la fuente de verdad); el operador decide contenido, no estructura. La página del panel renderiza **el mismo `StoreHomeLayout` que la tienda** con un `editControl` que superpone los lápices — no duplicar la maqueta, o se desincronizan. En la tienda una sección vacía se oculta; en Vitrina **siempre se ven todas** para poder llenarlas. `limit` = cuántos se ven a la vez, no cuántos caben (el resto rota en `AutoCarousel`); **Productos destacados es parrilla a propósito**, sin carrusel.

**Carrito** (`src/modules/cart/`): vive en localStorage y guarda SOLO `variantId` + `qty`. Los precios se resuelven en servidor (`resolveCart`) al pintar el carrito y otra vez al crear el pedido — nunca se confía en un precio que venga del navegador.

**Pedidos** (`src/modules/orders/`): `createOrder()` crea el pedido en una transacción con snapshot inmutable, cliente silencioso por match de email/teléfono E.164, vigencia 2 h e idempotencia por `checkoutToken` único. **No toca stock**. El enlace de WhatsApp usa `api.whatsapp.com/send`, **nunca `wa.me`**: su redirección rompe el emoji del saludo.

**Cuenta del comprador** (`src/modules/buyer/` + `src/app/(tienda)/cuenta/`): **deliberadamente NO usa Auth.js.** El comprador tiene su propia cookie (`kora_buyer`) y su propio camino de verificación —sesión opaca en base, revocable— porque el middleware protege `/admin` con `Boolean(auth?.user)`: si compartieran mecanismo, la seguridad del panel dependería de que toda ruta futura se acuerde de mirar una marca en el token. Así, para el panel un comprador es igual que alguien sin sesión, **por omisión**. Reglas: ninguna respuesta revela si un correo tiene cuenta (mismo mensaje siempre, y se quema el tiempo de bcrypt cuando no hay hash que comparar); el identificador del comprador va **en el `where`**, nunca en una comprobación posterior; la credencial cuelga del cliente, así que registrarse con un correo que ya compró como invitado recupera su historial y su cashback; con sesión el pedido se ata por identidad (`orders/customer-link.ts`) y el correo **no se reescribe desde el checkout**. `session.ts` no importa `next/headers` a propósito — el worker corre fuera de Next; el transporte vive en `session-cookie.ts`. **La recuperación de contraseña está bloqueada** hasta que el dominio tenga SPF/DKIM/DMARC.

**Correos transaccionales** (`src/modules/notifications/`): **alcance NUEVO, fuera de la cotización** (§6 solo pidió campañas) — pedido a Daniel el 1 ago. **Un correo por CADA estado** (decisión del cliente, 1 ago): al comprador —recibido con el enlace de WhatsApp, confirmado con su cashback, en preparación, enviado, entregado con la ventana de cambios, cancelado o expirado con el saldo devuelto— y al operador (pedido nuevo). El evento va dentro de la transacción que cambia el estado (`EVENTO_POR_ESTADO`), así que una transición rechazada no manda nada; si se añade un estado, hay que añadirlo ahí. **Dos listas distintas**: la baja de marketing frena campañas pero **NO** comprobantes —negárselos deja al comprador sin su única constancia—; la dirección no utilizable frena todo. **Nada se envía desde la acción**: `createOrder()`/`confirmOrder()` escriben su evento y el worker envía — hay una prueba que comprueba que esos archivos no importan el módulo de envío, porque perder una venta por un correo caído es cambiar un problema pequeño por el peor. **Se reserva antes de enviar** (índice único `(orderId, type)`): el peor caso es que alguien no reciba, nunca que reciba doble; al fallar el proveedor se suelta la marca de intento o el correo no saldría nunca. `pnpm staff:email` fija el destino del aviso; `pnpm emails:preview` escribe los siete a `.emails/` para que **el cliente los apruebe antes de que el dominio tenga SPF/DKIM/DMARC**.

**Ventas** (`src/modules/sales/` + `src/app/admin/ventas/`): alcance §2.4. **Un pedido no es una venta** —pendiente no vendió, cancelado dejó de vender, entregado sigue contando— y por eso va aparte de Pedidos, con permisos propios (`sales:view` / `sales:export`): el cajero atiende pedidos y no tiene por qué ver cuánto factura el negocio. La venta se **deriva** del pedido, sin tabla propia. `salesTotals()` devuelve **una fila por moneda, nunca un total plano**: así, sumar monedas exige decidirlo. Reutiliza `CONFIRMED_STATUSES` en vez de escribir su filtro. El CSV usa `;` y BOM porque es lo que Excel en español necesita.

**El día del negocio** (`src/lib/business-time.ts`): toda agrupación por fecha —gráfica, "ventas de hoy", cierre de mes— va en **America/Bogota**, no en el huso del servidor, que corre en UTC. Una venta de las 8 p.m. en Bogotá ya es del día siguiente en UTC: agrupando mal, la cifra es plausible pero está en la columna equivocada, y el último día del mes cae en el mes que no es. ⚠️ `confirmedAt` es `timestamp` **sin zona** con valor UTC: hay que declararlo UTC **antes** de pedirlo en Bogotá (`sqlBusinessDay()`); un solo `AT TIME ZONE` desplaza los días al lado contrario sin que nada falle.

**Kora Cashback** (`src/modules/cashback/`): sustituye a KoraPuntos, que quedó sin efecto el 1 ago 2026 — **la palabra "puntos" no vuelve a aparecer**, igual que "CRM". El 3 % de lo pagado **con dinero** (después de cupones y del propio cashback) se acredita al confirmar el pedido, en **lotes** con vigencia de 12 meses. Reglas que no se negocian: el saldo **solo cambia dentro de `ledger.ts`** —movimiento en el libro y materialización en la MISMA transacción, la regla 1 aplicada a dinero—; las bolsas de COP y USD **nunca se suman ni se convierten**; el consumo va del lote **más próximo a vencer**; vencer **registra un movimiento, no borra**. Acreditar dos veces lo impide el índice único parcial `cashback_un_lote_por_pedido`, no solo la comprobación del manejador: leer no es reservar y lo que se duplicaría es dinero. `pnpm cashback:verify` **avisa y no corrige**. **El canje ya existe** (`redemption.ts` + `refund.ts`): solo con sesión de comprador, sin combinar con cupones, y con el importe decidido **siempre en servidor**. **El saldo se descuenta al CREAR el pedido**, al revés que el stock y a propósito: reservar stock se lo quita a otros, el cashback es del propio comprador, y descontarlo al confirmar dejaría que dos pedidos pendientes comprometieran el mismo saldo y **`confirmOrder()` fallara** con el operador al teléfono. Si el pedido expira o se cancela, el saldo vuelve **a sus lotes originales** —nunca a uno nuevo, o abandonar pedidos renovaría un cashback por caducar— y la devolución se calcula por **saldo neto por lote**, para que el ciclo cancelar → reabrir → cancelar no regale ni pierda dinero. Ojo: `computeAccrual()` recibe el total del pedido, que **ya viene neto de cashback**; restárselo otra vez descontaría dos veces.

**Email marketing** (`src/modules/email/` + `campaigns/` + `consent/`): EML_HU001–004. **El envío real está BLOQUEADO** — `korashopp.com` no tiene SPF/DKIM/DMARC ni hay cuenta de proveedor (insumo del cliente desde el 31 jul). Todo lo demás está construido, con el envío detrás de una interfaz de dos drivers: en desarrollo el correo se **escribe a disco** (`.emails/`, se abre y se lee), en producción sale por el proveedor y **sin configurarlo la app no arranca** — mismo patrón y misma lección que las imágenes. Reglas: un destinatario **no recibe dos veces** (estado por fila, `FOR UPDATE SKIP LOCKED`, y se **reserva antes de enviar**: el peor caso es que alguien no reciba, no que reciba doble); una campaña **solo empieza a enviarse una vez** (escritura condicional en la base); audiencia y contenido **se congelan** al enviar; la supresión se comprueba **dos veces** —al armar la audiencia y en cada lote—; el enlace de baja va **firmado** (nadie puede dar de baja a otro) y **sin caducidad**; **volver a comprar NO re-suscribe** y el panel **no puede** re-suscribir. **No se usa BullMQ** pese al plan técnico: el worker con su programador ya existe y dos sistemas de cola serían dos formas de fallar (ver README del módulo). Las métricas del proveedor se muestran como **no disponibles**, nunca en cero.

**`confirmOrder()` es el evento central del sistema**: en UNA transacción descuenta stock por `applyStockMovement`, cambia el estado y escribe `order.confirmed` en `domain_events`. Es idempotente (segundo clic no duplica). El estado se mueve solo por `canTransition()` (`modules/orders/status.ts`): nunca retrocede. Expiración de pendientes: `pnpm orders:expire` (cron cada 5 min en prod). **El worker que consume la outbox todavía no existe** — los eventos se acumulan en PENDING a propósito.
