#!/usr/bin/env bash
# Despliegue de un entorno. Lo invoca GitHub Actions por SSH.
#
#   desplegar.sh <staging|production> <imagen-base> <etiqueta> <usuario-registro> <token-registro>
#
# Ver openspec/changes/vps-two-stack-deploy — specs/continuous-deployment.
#
# La propiedad que sostiene todo lo demás: SI ALGO FALLA, EL ENTORNO SIGUE
# SIRVIENDO LA ÚLTIMA VERSIÓN QUE FUNCIONABA. Por eso las migraciones corren en
# un contenedor efímero ANTES de tocar la aplicación, y por eso se guarda la
# etiqueta anterior antes de cambiar nada.

set -euo pipefail

ENTORNO="${1:?falta el entorno (staging|production)}"
IMAGEN_BASE="${2:?falta la imagen base}"
ETIQUETA="${3:?falta la etiqueta}"
REG_USER="${4:?falta el usuario del registro}"
REG_TOKEN="${5:?falta el token del registro}"

case "$ENTORNO" in
  staging)    COMPOSE="docker-compose.staging.yml"; ENVFILE=".env.staging"; URL="https://test.korashopp.com" ;;
  production) COMPOSE="docker-compose.prod.yml";    ENVFILE=".env.production"; URL="https://korashopp.com" ;;
  *) echo "✖ entorno desconocido: $ENTORNO" >&2; exit 2 ;;
esac

cd "$(dirname "$0")"
DC=(docker compose --env-file "$ENVFILE" -f "$COMPOSE")

IMG_APP="${IMAGEN_BASE}/app:${ETIQUETA}"
IMG_MIG="${IMAGEN_BASE}/migrator:${ETIQUETA}"

echo "▸ entorno   : $ENTORNO"
echo "▸ etiqueta  : $ETIQUETA"

# Etiqueta que está sirviendo AHORA. Es la que se restaura si algo sale mal.
ANTERIOR=$(grep -E "^KORA_IMAGE=" "$ENVFILE" | cut -d= -f2- || true)
echo "▸ anterior  : ${ANTERIOR:-(ninguna)}"

restaurar() {
  echo "✖ el despliegue falló — restaurando la versión anterior"
  if [ -n "$ANTERIOR" ]; then
    escribir_etiquetas "$ANTERIOR" "$(grep -E '^KORA_MIGRATOR_IMAGE=' "$ENVFILE.bak" | cut -d= -f2- || true)"
    "${DC[@]}" up -d --no-deps app >/dev/null 2>&1 || true
  fi
  docker logout ghcr.io >/dev/null 2>&1 || true
  exit 1
}

escribir_etiquetas() {
  local app="$1" mig="$2"
  sed -i "s|^KORA_IMAGE=.*|KORA_IMAGE=${app}|"           "$ENVFILE"
  sed -i "s|^KORA_MIGRATOR_IMAGE=.*|KORA_MIGRATOR_IMAGE=${mig}|" "$ENVFILE"
}

cp "$ENVFILE" "$ENVFILE.bak"

# ── 1. Descargar la imagen ───────────────────────────────────
# El token es EFÍMERO, del propio flujo de trabajo: se cierra sesión al
# terminar y no queda ninguna credencial permanente del registro en el servidor.
echo "$REG_TOKEN" | docker login ghcr.io -u "$REG_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

echo "▸ descargando imágenes"
docker pull -q "$IMG_APP" || restaurar
docker pull -q "$IMG_MIG" || restaurar

escribir_etiquetas "$IMG_APP" "$IMG_MIG"

# ── 2. Migraciones ANTES de tocar la aplicación ──────────────
# Si fallan, el despliegue se detiene aquí y la versión anterior sigue
# sirviendo: el esquema nunca queda a medias con la aplicación nueva encima.
echo "▸ aplicando migraciones"
if ! "${DC[@]}" run --rm migrate; then
  restaurar
fi

# ── 3. Recrear la aplicación ─────────────────────────────────
echo "▸ recreando la aplicación"
"${DC[@]}" up -d --no-deps --force-recreate app || restaurar

# ── 4. Comprobar que arrancó de verdad ───────────────────────
# No basta con que el contenedor exista: la guarda de arranque puede tumbarlo
# (por ejemplo, sin almacenamiento de imágenes configurado).
NOMBRE="kora-${ENTORNO/production/prod}-app"
for i in $(seq 1 20); do
  ESTADO=$(docker inspect -f '{{.State.Status}}' "$NOMBRE" 2>/dev/null || echo "ausente")
  case "$ESTADO" in
    running) echo "▸ en ejecución"; break ;;
    exited|restarting|dead)
      echo "✖ la aplicación no arrancó (estado: $ESTADO). Últimas líneas:"
      docker logs --tail 20 "$NOMBRE" 2>&1 || true
      restaurar ;;
  esac
  [ "$i" = "20" ] && { echo "✖ no llegó a estado 'running'"; restaurar; }
  sleep 3
done

# ── 5. Dejar constancia de qué está sirviendo ────────────────
printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$ENTORNO" "$ETIQUETA" >> ~/kora/deploy/historial-despliegues.tsv
rm -f "$ENVFILE.bak"

echo "✅ $ENTORNO desplegado — etiqueta $ETIQUETA — $URL"
