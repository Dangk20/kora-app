# syntax=docker/dockerfile:1
#
# Empaquetado de kora-app. Ver openspec/changes/vps-two-stack-deploy/design.md §1.
#
# Dos decisiones que conviene no revertir sin leer primero:
#
#  1. Base Debian slim y no Alpine. `sharp` (optimización de imágenes de next/image,
#     declarado en allowBuilds de pnpm-workspace.yaml) publica binarios precompilados
#     para glibc. En Alpine hay que compilarlo o pelear con musl, y esta imagen no
#     necesita ser diminuta: el servidor tiene 96 GB de disco.
#
#  2. Todo se compila DENTRO de la imagen. Nada de copiar un .next construido en la
#     máquina de nadie: además de no ser reproducible, `next build` copia el .env de
#     la raíz dentro de .next/standalone/ y eso metería AUTH_SECRET en la imagen.
#
# Objetivos:
#   runner   — la aplicación (por defecto)
#   migrator — contenedor efímero que aplica migraciones antes de recrear la aplicación

ARG NODE_VERSION=22-bookworm-slim
ARG PNPM_VERSION=11.15.0

# ─────────────────────────────────────────────────────────────
# base — pnpm disponible para el resto de etapas
# ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ─────────────────────────────────────────────────────────────
# deps — dependencias resueltas contra el lockfile, en su propia capa
# ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Sin `--mount=type=cache` a propósito: esa sintaxis exige BuildKit con buildx, que no
# está instalado en todas las máquinas del equipo. El cacheo por capas —que es el que
# ahorra tiempo de verdad— funciona igual mientras no cambien package.json ni el lockfile.
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────
# builder — cliente de Prisma + compilación de Next
# ─────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` exige una URL presente aunque no abra ninguna conexión.
# Es un valor de relleno del build y no queda en la imagen final: el runner
# no arrastra esta etapa.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm prisma generate

# DOCKER_BUILD=1 desactiva la revisión de tipos y lint DENTRO de la imagen
# (ver next.config.ts). El CI ya las corrió como compuerta antes de llegar aquí;
# repetirlas duplica el tiempo de cada despliegue y pide memoria que un ejecutor
# pequeño no siempre tiene.
ENV DOCKER_BUILD=1
RUN pnpm build

# ─────────────────────────────────────────────────────────────
# migrator — aplica migraciones y termina
# ─────────────────────────────────────────────────────────────
# Corre como paso previo del despliegue, no al arrancar la aplicación: si falla,
# el despliegue se detiene y la versión anterior sigue sirviendo
# (specs/continuous-deployment — "Las migraciones se aplican como parte del despliegue").
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
USER node

# Migrar Y SINCRONIZAR PERMISOS, en ese orden y en el mismo contenedor.
#
# Lo segundo no es un extra: la matriz de permisos vivía solo en el seed, que
# únicamente corre en bases nuevas, así que un permiso añadido nunca llegaba a
# un entorno existente. Cupones y Ventas quedaron invisibles en pruebas —
# desplegados, probados y sin forma de abrirlos, sin ningún error. Atándolo al
# mismo comando, no se puede olvidar.
#
# El binario directo, NO `pnpm prisma`: `prisma` no es un script de package.json,
# así que pnpm intenta resolverlo contra el registro de npm antes de ejecutarlo.
# Este contenedor corre en una red sin salida a internet (`internal: true`), así
# que esa consulta falla y se lleva por delante la migración entera.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/tsx prisma/sync-rbac.ts"]

# ─────────────────────────────────────────────────────────────
# worker — consumidor de la bandeja de salida de eventos
# ─────────────────────────────────────────────────────────────
# NO puede salir de `runner`: esa imagen es la salida *standalone* de Next, que
# solo lleva `server.js` y un node_modules podado — sin `tsx`, sin `scripts/` y
# sin `src/`. El worker necesita el código fuente y el ejecutor de TypeScript,
# igual que los demás trabajos del proyecto (`orders:expire`, `ledger:verify`).
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY --from=builder /app/src/generated ./src/generated
USER node
CMD ["node_modules/.bin/tsx", "scripts/outbox-worker.ts"]

# ─────────────────────────────────────────────────────────────
# sharpdeps — `sharp` instalado de verdad, no rastreado
# ─────────────────────────────────────────────────────────────
# **Por qué existe esta etapa.** El rastreo de archivos de Next es ESTÁTICO y
# `sharp` carga sus piezas con requires dinámicos según la plataforma. La salida
# standalone se llevaba `sharp` a medias: primero faltó el binario
# `@img/sharp-linux-x64`, y al forzarlo por glob siguió faltando `@img/colour`.
# Cada pieza que falta cuesta un despliegue entero, porque **en local nunca se
# ve**: en macOS `sharp` está completo con su propio binario.
#
# Se instala con **npm y no con pnpm** a propósito: npm deja un árbol plano de
# directorios REALES, y pnpm deja enlaces simbólicos hacia `.pnpm/`, que al
# copiarse a otra imagen apuntan a rutas que no existen. Aquí hacen falta
# archivos, no enlaces.
#
# La versión se fija a mano y debe coincidir con la de `package.json`. Lo
# comprueba `tests/imagen-docker.test.ts`, porque una discrepancia silenciosa
# devolvería justo el fallo que esta etapa existe para cerrar.
FROM base AS sharpdeps
ARG SHARP_VERSION=0.35.3
WORKDIR /sharp
# Todo lo suyo queda ANIDADO en `sharp/node_modules/`. Dos razones:
#   1. Node resuelve desde el directorio del módulo hacia arriba, así que el
#      paquete viaja entero en UNA copia y no puede faltarle una pieza.
#   2. No pisa nada del nivel superior. Copiar `semver` o `detect-libc` sobre
#      el node_modules podado de Next sería cambiar la versión que usa otro.
# Copiando solo `sharp` y `@img` faltaba `detect-libc` y la imagen moría al
# cargar el módulo: sus dependencias normales también hacen falta.
RUN npm init -y > /dev/null \
 && npm install --omit=dev sharp@${SHARP_VERSION} \
 && mkdir -p node_modules/sharp/node_modules \
 && cd node_modules \
 && for d in *; do [ "$d" = "sharp" ] || mv "$d" sharp/node_modules/; done

# ─────────────────────────────────────────────────────────────
# runner — la imagen que se publica
# ─────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# El standalone trae su propio node_modules podado: solo lo que la aplicación usa.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# `sharp` completo, por encima de lo que haya dejado el rastreo. Sin esto la
# aplicación arranca, responde 200 en toda la tienda, y revienta en la primera
# pantalla que toca una imagen — que es la que usa el operador para cargar el
# catálogo.
COPY --from=sharpdeps --chown=node:node /sharp/node_modules/sharp ./node_modules/sharp

# Falla el BUILD si `sharp` no se puede cargar, en vez de fallar en producción
# cuando el operador sube una foto. Es la comprobación que faltaba: las dos
# vueltas anteriores se dieron por buenas mirando el build de macOS.
RUN node -e "const s=require('sharp'); s({create:{width:8,height:8,channels:3,background:'#000'}}).webp().toBuffer().then(()=>console.log('sharp OK'),e=>{console.error(e);process.exit(1)})"

# Sin privilegios: si alguien logra ejecución dentro del contenedor, no es root.
USER node

EXPOSE 3000
CMD ["node", "server.js"]
