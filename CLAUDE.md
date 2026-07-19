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

El detalle vivo está en `../bitacora-sprints-kora.md`. Resumen al 19 jul 2026: S1–S2 cerradas, S3 casi completa (falta **importador Excel + plantilla** e **imágenes** — abstracción storage con driver local en dev y R2 en prod), S4 (motor de inventario) **cerrada y testeada**. Staging bloqueado por accesos SSH/DNS del cliente. 21 tests verdes.
