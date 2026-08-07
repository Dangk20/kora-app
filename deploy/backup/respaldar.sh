#!/usr/bin/env bash
#
# Respaldo cifrado de la base de KORA.
#
# Corre en el ANFITRIÓN (no en un contenedor) y entra a la base por
# `docker exec`. La red `interna` es `internal: true` —la base no tiene salida a
# internet, a propósito— así que un contenedor ahí dentro no podría subir nada,
# y darle salida crearía justo la ruta de exfiltración que ese aislamiento
# existe para no tener. `docker exec` no usa red.
#
# El volcado se cifra con la clave PÚBLICA antes de salir del servidor. El
# servidor puede crear respaldos y NO puede leerlos: si alguien lo compromete,
# no se lleva además el histórico de datos personales de todos los clientes.
# La contrapartida es real: perder la clave privada hace los respaldos
# irrecuperables. Ver README.md de este directorio.
#
# Uso:
#   ./respaldar.sh                    # lee la configuración de .env.production
#   KORA_BACKUP_ENV=.env.staging ./respaldar.sh
#
# Ver openspec/changes/encrypted-db-backup — specs/database-backup.

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────────────────────

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVO_ENV="${KORA_BACKUP_ENV:-$AQUI/../.env.production}"

if [[ -f "$ARCHIVO_ENV" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ARCHIVO_ENV"; set +a
fi

CONTENEDOR="${KORA_BACKUP_CONTAINER:-kora-prod-postgres}"
DESTINO="${KORA_BACKUP_REMOTE:-}"            # p.ej. r2:kora-respaldos/produccion
CLAVE_PUBLICA="${KORA_BACKUP_AGE_RECIPIENT:-}"
DIAS_RETENCION="${KORA_BACKUP_RETENTION_DAYS:-30}"
REGISTRO="${KORA_BACKUP_LOG:-/var/log/kora-backup.log}"

# Volumen de Docker donde viven las imágenes de producto. Solo aplica cuando
# el almacenamiento es el disco del servidor (KORA_STORAGE_DRIVER=disk); con
# almacenamiento remoto aquí no vive nada.
VOLUMEN_IMAGENES="${KORA_BACKUP_UPLOADS_VOLUME:-kora-prod_uploads}"
DRIVER_ALMACENAMIENTO="${KORA_STORAGE_DRIVER:-disk}"

# ─────────────────────────────────────────────────────────────
# Registro
# ─────────────────────────────────────────────────────────────

# Cada ejecución deja constancia, con éxito o sin él: es lo que lee
# `pnpm backup:status`. Un respaldo que dejó de correr no produce ningún error
# por sí mismo — sin este rastro, "lleva tres semanas sin respaldar" es
# indistinguible de "todo va bien".
anotar() {
  local nivel="$1"; shift
  local linea
  linea="$(date -u +%Y-%m-%dT%H:%M:%SZ)|$nivel|$*"
  echo "$linea"
  # Si el registro no se puede escribir, no se aborta el respaldo por eso:
  # perder la trazabilidad es malo, no respaldar es peor.
  #
  # Las llaves no sobran: bash aplica las redirecciones de izquierda a derecha,
  # así que `>> "$REGISTRO" 2>/dev/null` falla y ESCRIBE el "Permission denied"
  # antes de que el `2>/dev/null` llegue a aplicarse. Agrupando, el silencio
  # cubre el error de la redirección misma.
  { echo "$linea" >> "$REGISTRO"; } 2>/dev/null || true
}

morir() {
  anotar ERROR "$*"
  exit 1
}

# ─────────────────────────────────────────────────────────────
# Comprobaciones ANTES de volcar nada
# ─────────────────────────────────────────────────────────────
#
# El orden importa: si falta la clave de cifrado y se comprobara después de
# volcar, ya habría un volcado sin cifrar en el disco. Se comprueba todo antes
# de generar el primer byte.

[[ -n "$CLAVE_PUBLICA" ]] || morir "Falta KORA_BACKUP_AGE_RECIPIENT (clave pública de cifrado). No se vuelca nada sin ella."
[[ -n "$DESTINO" ]]       || morir "Falta KORA_BACKUP_REMOTE (destino remoto)."

command -v age >/dev/null     || morir "Falta 'age'. Ver deploy/backup/README.md."
command -v rclone >/dev/null  || morir "Falta 'rclone'. Ver deploy/backup/README.md."
command -v docker >/dev/null  || morir "Falta 'docker'."

docker inspect --format '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true \
  || morir "El contenedor '$CONTENEDOR' no está en ejecución."

# ─────────────────────────────────────────────────────────────
# Espacio de trabajo con limpieza garantizada
# ─────────────────────────────────────────────────────────────
#
# Un volcado sin cifrar olvidado en el disco anula el cifrado: quien entre al
# servidor lo encuentra ahí. El `trap` cubre la salida normal, el error y la
# interrupción — no solo el camino feliz.

TRABAJO="$(mktemp -d "${TMPDIR:-/tmp}/kora-backup.XXXXXXXX")"
chmod 700 "$TRABAJO"

limpiar() {
  rm -rf "$TRABAJO"
}
trap limpiar EXIT INT TERM

# ─────────────────────────────────────────────────────────────
# Volcar → cifrar → subir
# ─────────────────────────────────────────────────────────────

SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
NOMBRE="kora-${SELLO}.tar.age"
LOCAL="$TRABAJO/$NOMBRE"

anotar INFO "iniciando respaldo de '$CONTENEDOR'"

# ── 1. La base ───────────────────────────────────────────────
#
# `-Fc` (formato personalizado) y no SQL plano: comprime, permite restaurar en
# paralelo y —lo que importa— `pg_restore` DETECTA un archivo truncado. Un .sql
# truncado se restaura "bien" hasta donde llega y deja una base a medias sin que
# nada falle: la forma más silenciosa de perder datos durante una recuperación.
#
# No bloquea escrituras (MVCC): la tienda sigue vendiendo mientras corre.
if ! docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "$CONTENEDOR" \
      pg_dump -Fc -U "${POSTGRES_USER:-kora}" -d "${POSTGRES_DB:-kora}" \
      > "$TRABAJO/base.dump" 2> "$TRABAJO/pg_dump.err"; then
  morir "pg_dump falló: $(head -c 500 "$TRABAJO/pg_dump.err")"
fi

[[ -s "$TRABAJO/base.dump" ]] || morir "el volcado de la base salió vacío"

# ── 2. Las imágenes de producto ──────────────────────────────
#
# Sin ellas, restaurar devolvería el catálogo completo y ni una sola foto — y
# las fotos son un insumo del cliente que costó semanas conseguir.
#
# Se leen con un contenedor efímero montando el volumen, y no por una ruta del
# anfitrión: un volumen de Docker vive bajo /var/lib/docker con permisos de
# root, y un bind mount traería el problema de que el usuario del contenedor y
# el del anfitrión coincidan. Esto no depende de ninguna de las dos cosas.
if [[ "$DRIVER_ALMACENAMIENTO" == "disk" ]]; then
  if ! docker volume inspect "$VOLUMEN_IMAGENES" >/dev/null 2>&1; then
    morir "el volumen de imágenes '$VOLUMEN_IMAGENES' no existe. Sin él las fotos no están en ningún sitio persistente."
  fi

  if ! docker run --rm -v "$VOLUMEN_IMAGENES":/data:ro alpine:3 \
        tar -cf - -C /data . > "$TRABAJO/imagenes.tar" 2> "$TRABAJO/tar.err"; then
    morir "no se pudieron leer las imágenes: $(head -c 500 "$TRABAJO/tar.err")"
  fi

  anotar INFO "imágenes empaquetadas ($(wc -c < "$TRABAJO/imagenes.tar" | tr -d ' ') bytes)"
else
  # Con almacenamiento remoto no hay imágenes locales que respaldar, y decirlo
  # evita que alguien lea el tamaño del respaldo y crea que están dentro.
  : > "$TRABAJO/imagenes.tar"
  anotar INFO "almacenamiento remoto: el respaldo NO incluye imágenes (viven fuera del servidor)"
fi

# ── 3. Un solo archivo cifrado ───────────────────────────────
#
# Base e imágenes van juntas a propósito. Dos archivos separados pueden
# desincronizarse —la base de hoy con las imágenes de ayer— y obligan a acertar
# la pareja durante una recuperación, con prisa. Uno solo hace imposible
# restaurar mitades que no se corresponden.
#
# La tubería se comprueba etapa por etapa con PIPESTATUS: sin eso, un `tar` que
# muere a mitad devuelve éxito porque `age` sí terminó bien, y se subiría un
# archivo truncado como si fuera un respaldo bueno.
set +e
tar -cf - -C "$TRABAJO" base.dump imagenes.tar | age -r "$CLAVE_PUBLICA" -o "$LOCAL"
ESTADOS=("${PIPESTATUS[@]}")
set -e

[[ "${ESTADOS[0]}" -eq 0 ]] || morir "el empaquetado falló (código ${ESTADOS[0]})"
[[ "${ESTADOS[1]}" -eq 0 ]] || morir "el cifrado falló (código ${ESTADOS[1]})"

[[ -s "$LOCAL" ]] || morir "el respaldo salió vacío"

TAMANO="$(wc -c < "$LOCAL" | tr -d ' ')"
anotar INFO "volcado cifrado: $NOMBRE ($TAMANO bytes)"

rclone copyto "$LOCAL" "$DESTINO/$NOMBRE" \
  || morir "el envío a '$DESTINO' falló"

# Confirmar que el objeto EXISTE en el destino antes de dar nada por bueno.
# `rclone copyto` puede devolver éxito y dejar el destino sin el objeto si el
# remoto está mal configurado.
rclone lsf "$DESTINO/$NOMBRE" >/dev/null 2>&1 \
  || morir "el envío se reportó correcto pero el objeto no está en el destino"

anotar OK "respaldo subido: $NOMBRE ($TAMANO bytes)"

# ─────────────────────────────────────────────────────────────
# Rotación — SOLO después de confirmar el envío
# ─────────────────────────────────────────────────────────────
#
# Rotar antes dejaría al negocio, aunque sean segundos, con un respaldo menos y
# ninguno nuevo. Improbable y de consecuencia total; y solo se manifestaría
# cuando ya ha fallado algo.

if ! rclone delete --min-age "${DIAS_RETENCION}d" "$DESTINO" 2>/dev/null; then
  # Un fallo rotando no invalida el respaldo del día: se avisa y se sale bien.
  anotar WARN "no se pudo rotar lo anterior a ${DIAS_RETENCION} días; el respaldo del día SÍ está subido"
  exit 0
fi

anotar INFO "rotación completada (retención: ${DIAS_RETENCION} días)"
