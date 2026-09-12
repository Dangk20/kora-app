#!/usr/bin/env bash
# Corre un script de `scripts/` contra un entorno del servidor, en un
# contenedor DESECHABLE de la imagen del worker.
#
#   ./kora-tsx.sh staging scripts/create-admin.ts correo "Nombre"
#   ./kora-tsx.sh staging scripts/import-kora-excel.ts /datos/inventario.xlsx --fotos /datos/fotos --actor correo
#   ./kora-tsx.sh staging scripts/import-photos.ts /datos/fotos
#
# ¿Por qué un contenedor aparte y no `docker exec` en el worker? El worker
# corre con `mem_limit: 256m`, y un segundo proceso de tsx + Prisma dentro del
# mismo cgroup se queda sin memoria: el 12 sep 2026 `create-admin` se colgó y
# murió con 137 sin imprimir nada. Aparte, arranca en menos de un segundo.
#
# Lo que hay en ~/datos del anfitrión se ve en /datos dentro del contenedor.
# La entrada estándar pasa tal cual (para la contraseña de create-admin).
set -euo pipefail
ENTORNO="${1:?falta el entorno (staging|production)}"; shift
case "$ENTORNO" in
  staging)    ENVFILE=".env.staging";    RED="kora-staging-interna"; VOL="kora-staging_uploads" ;;
  production) ENVFILE=".env.production"; RED="kora-prod-interna";    VOL="kora-prod_uploads" ;;
  *) echo "✖ entorno desconocido: $ENTORNO" >&2; exit 2 ;;
esac
cd "$(dirname "$0")"
IMG=$(grep -E "^KORA_WORKER_IMAGE=" "$ENVFILE" | cut -d= -f2-)
[ -n "$IMG" ] || { echo "✖ no hay KORA_WORKER_IMAGE en $ENVFILE" >&2; exit 1; }
mkdir -p "$HOME/datos"
exec docker run --rm -i \
  --network "$RED" \
  --env-file "$ENVFILE" \
  -e KORA_STORAGE_DRIVER=disk -e KORA_UPLOADS_DIR=/data/uploads \
  -v "$VOL:/data/uploads" \
  -v "$HOME/datos:/datos:ro" \
  "$IMG" node_modules/.bin/tsx "$@"
