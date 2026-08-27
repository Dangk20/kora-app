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
IMG_WRK="${IMAGEN_BASE}/worker:${ETIQUETA}"

echo "▸ entorno   : $ENTORNO"
echo "▸ etiqueta  : $ETIQUETA"

# Etiqueta que está sirviendo AHORA. Es la que se restaura si algo sale mal.
ANTERIOR=$(grep -E "^KORA_IMAGE=" "$ENVFILE" | cut -d= -f2- || true)
echo "▸ anterior  : ${ANTERIOR:-(ninguna)}"

restaurar() {
  echo "✖ el despliegue falló — restaurando la versión anterior"
  if [ -n "$ANTERIOR" ]; then
    escribir_etiquetas "$ANTERIOR" \
      "$(grep -E '^KORA_MIGRATOR_IMAGE=' "$ENVFILE.bak" | cut -d= -f2- || true)" \
      "$(grep -E '^KORA_WORKER_IMAGE=' "$ENVFILE.bak" | cut -d= -f2- || true)"
    "${DC[@]}" up -d --no-deps app worker >/dev/null 2>&1 || true
  fi
  docker logout ghcr.io >/dev/null 2>&1 || true
  exit 1
}

# Sustituye la línea si existe y la AÑADE si no. Con `sed` a secas, una
# variable que todavía no está en el archivo se ignoraba en silencio: el
# servicio arrancaba con el valor por defecto del compose —una imagen local
# inexistente— y fallaba sin que el despliegue se enterara.
fijar_var() {
  local clave="$1" valor="$2"
  if grep -q "^${clave}=" "$ENVFILE"; then
    sed -i "s|^${clave}=.*|${clave}=${valor}|" "$ENVFILE"
  else
    printf '%s=%s\n' "$clave" "$valor" >> "$ENVFILE"
  fi
}

escribir_etiquetas() {
  fijar_var KORA_IMAGE          "$1"
  fijar_var KORA_MIGRATOR_IMAGE "$2"
  fijar_var KORA_WORKER_IMAGE   "$3"
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
docker pull -q "$IMG_WRK" || restaurar

escribir_etiquetas "$IMG_APP" "$IMG_MIG" "$IMG_WRK"

# ── 2. Migraciones ANTES de tocar la aplicación ──────────────
# Si fallan, el despliegue se detiene aquí y la versión anterior sigue
# sirviendo: el esquema nunca queda a medias con la aplicación nueva encima.
echo "▸ aplicando migraciones"
if ! "${DC[@]}" run --rm migrate; then
  restaurar
fi

# ── 3. Recrear la aplicación ─────────────────────────────────
echo "▸ recreando la aplicación y el worker"
"${DC[@]}" up -d --no-deps --force-recreate app worker || restaurar

# ── 4. Comprobar que arrancó de verdad, Y QUE SIGUE ARRANCADO ─
# No basta con que el contenedor exista: la guarda de arranque puede tumbarlo
# (por ejemplo, sin almacenamiento de imágenes configurado).
#
# ⚠️ Y tampoco basta con verlo `running` una vez. Un contenedor que reinicia en
# bucle pasa por `running` unos instantes en CADA vuelta, así que mirarlo en el
# momento equivocado declara bueno un despliegue roto —y deja producción caída
# con el despliegue en verde, que es peor que fallar—.
#
# No es hipotético: el 27 ago 2026, al levantar producción por primera vez sin
# las variables del correo, la aplicación anunciaba "✓ Ready in 101ms" y moría
# inmediatamente después, 10 veces en un minuto. Con la comprobación anterior
# —romper el bucle en el primer `running`— una de cada nueve pasadas habría
# dicho "desplegado" sobre una aplicación que no servía una sola petición.
#
# Por eso se exige que esté `running` varias veces SEGUIDAS y que el contador
# de reinicios no se mueva entre medias. Un bucle de reinicio falla las dos.
ESTABLES_NECESARIOS=4   # 4 × 3 s ≈ 12 s en pie sin reiniciar
NOMBRE="kora-${ENTORNO/production/prod}-app"
estables=0
reinicios_previos=""

for i in $(seq 1 30); do
  ESTADO=$(docker inspect -f '{{.State.Status}}' "$NOMBRE" 2>/dev/null || echo "ausente")
  REINICIOS=$(docker inspect -f '{{.RestartCount}}' "$NOMBRE" 2>/dev/null || echo "?")

  case "$ESTADO" in
    running)
      if [ -n "$reinicios_previos" ] && [ "$REINICIOS" != "$reinicios_previos" ]; then
        echo "✖ la aplicación reinicia en bucle ($REINICIOS reinicios). Últimas líneas:"
        docker logs --tail 30 "$NOMBRE" 2>&1 || true
        restaurar
      fi
      estables=$((estables + 1))
      if [ "$estables" -ge "$ESTABLES_NECESARIOS" ]; then
        echo "▸ en ejecución y estable (${REINICIOS} reinicios)"
        break
      fi
      ;;
    exited|dead)
      echo "✖ la aplicación no arrancó (estado: $ESTADO). Últimas líneas:"
      docker logs --tail 30 "$NOMBRE" 2>&1 || true
      restaurar ;;
    restarting)
      echo "✖ la aplicación reinicia en bucle (estado: $ESTADO). Últimas líneas:"
      docker logs --tail 30 "$NOMBRE" 2>&1 || true
      restaurar ;;
  esac

  reinicios_previos="$REINICIOS"
  [ "$i" = "30" ] && { echo "✖ no llegó a estar estable"; restaurar; }
  sleep 3
done

# ── 5. Dejar constancia de qué está sirviendo ────────────────
printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$ENTORNO" "$ETIQUETA" >> ~/kora/deploy/historial-despliegues.tsv
rm -f "$ENVFILE.bak"

echo "✅ $ENTORNO desplegado — etiqueta $ETIQUETA — $URL"
