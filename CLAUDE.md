# CLAUDE.md — kora-app

E-commerce KORA (venta cerrada, 18 semanas: 11 jul → 13 nov 2026). **Monolito modular** — microservicios/K8s/serverless descartados a propósito. El riesgo del proyecto no es escala: es **correctitud bajo concurrencia** (web y POS compiten por el mismo stock).

Documentos rectores (leer antes de decidir):
- `../plan-tecnico-ejecucion-kora.md` — arquitectura, stack, DoD por semana, riesgos.
- `../bitacora-sprints-kora.md` — **estado real de ejecución** (qué está hecho, qué sigue, deudas). Actualizarla al cerrar cada sesión de trabajo.
- `../../business/hitos-semanales-kora.md` — cronograma cara al cliente (no tocar sin razón).
- Prototipo aprobado: `../design-handoff/Kora.dc.html` + `HANDOFF.md`.

## Stack

Next.js 15 (App Router) + TypeScript · Tailwind 4 + shadcn/ui · PostgreSQL 16 + Prisma 7 (adapter pg, config en `prisma.config.ts`) · Redis (futuro: caché/colas) · Auth.js v5 (JWT 12h) · Vitest · CI en GitHub Actions (`Dangk20/kora-app`).

## Comandos

```bash
pnpm db:up          # Postgres (puerto 5433) + Redis (6380) — puertos no estándar a propósito
pnpm db:migrate     # migraciones (nunca cambios de esquema a mano)
pnpm db:seed        # roles, permisos, admin dev, catálogo demo
pnpm dev            # desarrollo · pnpm start = build de producción
pnpm test           # Vitest (integración contra el Postgres local — debe estar arriba)
pnpm typecheck && pnpm lint && pnpm build   # lo que corre el CI
pnpm ledger:verify  # verificación del libro contable (futuro cron nocturno)
```

Login dev: `admin@kora.local` / `kora-dev-2026` · cajero: `caja@kora.local` / `caja-dev-2026`.

## Reglas innegociables

1. **`stockActual` y `onlineUnits` SOLO cambian dentro de `src/modules/inventory/engine.ts`** (transacción con `SELECT ... FOR UPDATE` + movimiento en `stock_movements` + materialización). Ni seeds, ni importadores, ni actions se lo saltan. El test de aceptación (50 compras concurrentes sobre stock=1 → exactamente 1 gana) vive en `tests/inventory.test.ts` y no es negociable.
2. **El stock es UN pool.** `onlineUnits` es asignación de canal, no un segundo stock: la web vende hasta su cupo; el POS nunca se bloquea (clamp automático del cupo).
3. **`order.confirmed` será el evento central** (outbox en `domain_events`) — el pago ocurre por WhatsApp, fuera de la plataforma. Decisión cerrada: el stock solo se descuenta al confirmar (sin reserva).
4. **Toda Server Action protegida usa `requirePermission("modulo:accion")`** (verifica contra la BASE, no el JWT — revocación inmediata). La matriz de permisos está fijada por tests (`tests/rbac.test.ts`).
5. **Fidelidad de diseño:** toda pantalla nueva se construye mirando su equivalente en el prototipo aprobado (`Kora.dc.html`) — layout y patrones del prototipo; **color y tipografía del manual de marca** (tokens en `src/app/globals.css`: gradiente `bg-kora-gradient` 135°, neutros kora-*, Manrope/Allura). Botón principal = variant `brand`.
6. **La lógica vive en `src/modules/<dominio>/`** (ver su README); las rutas de `src/app/` son delgadas. Slide-overs controlados por URL (`?nuevo=1`, `?editar=id`, `?ajustar=id`).
7. Migraciones versionadas siempre; ningún secreto en el repo (`.env` ignorado, plantilla en `.env.example`).

## Estado y pendientes

El detalle vivo está en `../bitacora-sprints-kora.md`. Resumen al 19 jul 2026: **S1–S5 cerradas** (S5 = tienda pública: catálogo, adelantada). Staging bloqueado por accesos SSH/DNS del cliente. 56 tests verdes.

**Importador de catálogo** (`src/modules/catalog/import/`): las columnas del Excel se definen UNA vez en `columns.ts` — plantilla, parser y validación salen de ahí; si cambia una columna, cambia solo ese archivo. La importación valida todo el archivo antes de escribir (todo-o-nada) y el stock inicial entra por `receiveStock()` del motor, nunca por fuera. Un SKU que ya existe actualiza precios pero **jamás** vuelve a sumar stock.

**Almacenamiento** (`src/modules/storage/`): interfaz con dos drivers — disco local en dev (`.uploads/`, servido por `/media/[...key]`, solo dev) y R2 en producción. Se elige por variables de entorno; en producción, sin R2 configurado la app **falla al arrancar** (el VPS nunca sirve imágenes). El tipo de archivo se valida por magic numbers, no por el content-type del navegador.

**Precios** (`src/modules/pricing/`): `resolvePrice()` es la ÚNICA fuente de precio de tienda, carrito, checkout y snapshot del pedido (CAT_HU001 §3). Ninguna vista calcula precios. Reglas que no se negocian: cada divisa usa **su precio cargado** (nunca conversión por tasa), y el tachado + badge "Precio especial online" solo aparecen si el precio online es **realmente menor** que el de tienda en la misma moneda.

**Tienda pública** (`src/app/(tienda)/` + `src/modules/storefront/`): home, `/catalogo`, `/producto/[slug]`, `/carrito` y `/checkout`. "Disponible" = `onlineUnits > 0` (cupo online), no el stock total. Las cards del catálogo **no llevan botón**: la compra se decide en la ficha. No publicar promesas comerciales que el negocio no sostiene (cuotas, compra protegida, envío gratis, devoluciones): ver `../notas-tecnicas-privado.md` §Tienda pública.

**Vitrina** (`src/modules/showcase/` + `src/app/admin/vitrina/`): administra la portada de la tienda. Las secciones son **fijas** (`sections.ts` es la fuente de verdad); el operador decide contenido, no estructura. La página del panel renderiza **el mismo `StoreHomeLayout` que la tienda** con un `editControl` que superpone los lápices — no duplicar la maqueta, o se desincronizan. En la tienda una sección vacía se oculta; en Vitrina **siempre se ven todas** para poder llenarlas. `limit` = cuántos se ven a la vez, no cuántos caben (el resto rota en `AutoCarousel`); **Productos destacados es parrilla a propósito**, sin carrusel.

**Carrito** (`src/modules/cart/`): vive en localStorage y guarda SOLO `variantId` + `qty`. Los precios se resuelven en servidor (`resolveCart`) al pintar el carrito y otra vez al crear el pedido — nunca se confía en un precio que venga del navegador.

**Pedidos** (`src/modules/orders/`): `createOrder()` crea el pedido en una transacción con snapshot inmutable, cliente silencioso por match de email/teléfono E.164, vigencia 2 h e idempotencia por `checkoutToken` único. **No toca stock**. El enlace de WhatsApp usa `api.whatsapp.com/send`, **nunca `wa.me`**: su redirección rompe el emoji del saludo.

**`confirmOrder()` es el evento central del sistema**: en UNA transacción descuenta stock por `applyStockMovement`, cambia el estado y escribe `order.confirmed` en `domain_events`. Es idempotente (segundo clic no duplica). El estado se mueve solo por `canTransition()` (`modules/orders/status.ts`): nunca retrocede. Expiración de pendientes: `pnpm orders:expire` (cron cada 5 min en prod). **El worker que consume la outbox todavía no existe** — los eventos se acumulan en PENDING a propósito.
