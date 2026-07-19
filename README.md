# KORA — plataforma e-commerce

Monolito modular: Next.js 15 (App Router) + TypeScript + Tailwind · PostgreSQL 16 + Prisma · Redis.
Arquitectura y decisiones: `../plan-tecnico-ejecucion-kora.md` · Seguimiento de sprints: `../bitacora-sprints-kora.md`.

## Desarrollo local

Requisitos: Node 22+, pnpm (vía `corepack enable`), Docker.

```bash
pnpm install
pnpm db:up        # Postgres (puerto 5433) + Redis (6380) en Docker
cp .env.example .env   # y ajustar si hace falta
pnpm db:migrate   # aplica migraciones
pnpm db:seed      # roles, permisos, admin y catálogo demo
pnpm dev          # http://localhost:3000
```

Login de desarrollo: `admin@kora.local` / `kora-dev-2026` (solo seed local).

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm test` | Tests (incluye la invariante del libro contable) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:studio` | Prisma Studio (explorar la base) |

## Reglas de ingeniería (no negociables)

1. **`stockActual` solo se modifica dentro de la función transaccional de inventario** (`src/modules/inventory`, S4). Ningún otro código lo toca — ni siquiera los seeds se saltan el libro contable.
2. **Nada de estado en memoria del proceso** — sesión y caché van a Redis.
3. **Migraciones versionadas siempre** (`prisma migrate dev`); jamás cambios de esquema a mano.
4. **Ningún secreto en el repo** — `.env` está ignorado; la plantilla es `.env.example`.
5. **La lógica vive en `src/modules/`** (ver su README); las rutas de `src/app/` son delgadas.
