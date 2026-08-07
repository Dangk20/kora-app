#!/usr/bin/env bash
#
# Restauración de un respaldo cifrado de KORA.
#
# Se ejecuta bajo presión, en el peor día del proyecto y posiblemente por
# alguien que no escribió esto. Por eso: destino SIEMPRE explícito, sin valor
# por defecto, y confirmación adicional si la base ya tiene datos. Restaurar
# sobre la base equivocada destruye datos vivos, y ocurriría exactamente en el
# momento en que nadie puede permitírselo.
#
# Uso:
#   ./restaurar.sh --archivo kora-2026....tar.age \
#                  --clave ~/kora-backup.key \
#                  --base kora_restaurada \
#                  [--contenedor kora-prod-postgres] [--volumen kora-prod_uploads]
#
# El respaldo trae la base Y las imágenes de producto en un solo archivo
# cifrado: separarlos permitiría restaurar la base de hoy con las fotos de
# ayer, y decidir la pareja correcta con prisa.
#
# La clave PRIVADA no vive en el servidor: se trae para restaurar y se lleva.
# Ver README.md de este directorio.
#
# Ver openspec/changes/encrypted-db-backup — specs/backup-restore.

set -euo pipefail

ARCHIVO=""
CLAVE=""
BASE=""
CONTENEDOR="${KORA_BACKUP_CONTAINER:-kora-prod-postgres}"
VOLUMEN_IMAGENES="${KORA_BACKUP_UPLOADS_VOLUME:-kora-prod_uploads}"
SI_A_TODO="no"

uso() {
  cat >&2 <<'EOF'
Restauración de un respaldo cifrado de KORA.

  --archivo   <ruta>   Respaldo cifrado (.tar.age). Obligatorio.
  --clave     <ruta>   Clave PRIVADA de age. Obligatoria.
  --base      <nombre> Base de destino. Obligatoria, SIN valor por defecto.
  --contenedor <nombre> Contenedor de PostgreSQL (por omisión: kora-prod-postgres).
  --volumen   <nombre> Volumen de Docker de las imágenes de producto
                       (por omisión: kora-prod_uploads). Cadena vacía para omitirlas.
  --si                 No preguntar aunque la base tenga datos.

No hay destino por defecto a propósito: restaurar sobre la base equivocada
destruye datos vivos, y esto se ejecuta con prisa.
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archivo)     ARCHIVO="${2:-}"; shift 2 ;;
    --clave)       CLAVE="${2:-}"; shift 2 ;;
    --base)        BASE="${2:-}"; shift 2 ;;
    --contenedor)  CONTENEDOR="${2:-}"; shift 2 ;;
    --volumen)     VOLUMEN_IMAGENES="${2:-}"; shift 2 ;;
    --si)          SI_A_TODO="si"; shift ;;
    -h|--help)     uso ;;
    *) echo "Argumento desconocido: $1" >&2; uso ;;
  esac
done

# Se comprueba TODO antes de tocar nada.
[[ -n "$ARCHIVO" ]] || { echo "✖ Falta --archivo." >&2; uso; }
[[ -n "$CLAVE" ]]   || { echo "✖ Falta --clave (clave privada de age)." >&2; uso; }
[[ -n "$BASE" ]]    || { echo "✖ Falta --base. No hay destino por defecto: dilo explícitamente." >&2; uso; }

[[ -f "$ARCHIVO" ]] || { echo "✖ No existe el archivo '$ARCHIVO'." >&2; exit 1; }
[[ -f "$CLAVE" ]]   || { echo "✖ No existe la clave '$CLAVE'." >&2; exit 1; }

command -v age >/dev/null    || { echo "✖ Falta 'age'." >&2; exit 1; }
command -v docker >/dev/null || { echo "✖ Falta 'docker'." >&2; exit 1; }

docker inspect --format '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true \
  || { echo "✖ El contenedor '$CONTENEDOR' no está en ejecución." >&2; exit 1; }

USUARIO="${POSTGRES_USER:-kora}"

psql_en() {
  docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "$CONTENEDOR" \
    psql -U "$USUARIO" -d "${1:-postgres}" "${@:2}"
}

# ─────────────────────────────────────────────────────────────
# ¿La base de destino ya tiene datos?
# ─────────────────────────────────────────────────────────────

EXISTE="$(psql_en postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$BASE'" || true)"

if [[ "$EXISTE" == "1" ]]; then
  TABLAS="$(psql_en "$BASE" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" || echo 0)"

  if [[ "${TABLAS:-0}" -gt 0 && "$SI_A_TODO" != "si" ]]; then
    echo ""
    echo "⚠  La base '$BASE' YA EXISTE y tiene $TABLAS tabla(s)."
    echo "   Restaurar encima SOBRESCRIBE lo que haya."
    echo ""
    read -r -p "   Escribe el nombre de la base para confirmar: " CONFIRMA
    [[ "$CONFIRMA" == "$BASE" ]] || { echo "✖ Cancelado." >&2; exit 1; }
  fi
else
  echo "→ Creando la base '$BASE'…"
  psql_en postgres -c "CREATE DATABASE \"$BASE\"" >/dev/null
fi

# ─────────────────────────────────────────────────────────────
# Descifrar y restaurar
# ─────────────────────────────────────────────────────────────

TRABAJO="$(mktemp -d "${TMPDIR:-/tmp}/kora-restore.XXXXXXXX")"
chmod 700 "$TRABAJO"
trap 'rm -rf "$TRABAJO"' EXIT INT TERM

echo "→ Descifrando…"
age -d -i "$CLAVE" -o "$TRABAJO/kora.tar" "$ARCHIVO" \
  || { echo "✖ No se pudo descifrar. ¿Es la clave privada correcta?" >&2; exit 1; }

tar -xf "$TRABAJO/kora.tar" -C "$TRABAJO" \
  || { echo "✖ El respaldo está corrupto: no se pudo desempaquetar." >&2; exit 1; }

[[ -s "$TRABAJO/base.dump" ]] || { echo "✖ El respaldo no contiene el volcado de la base." >&2; exit 1; }

echo "→ Restaurando la base en '$BASE'…"
# `--clean --if-exists`: la restauración es repetible. `--exit-on-error` para
# que un fallo a mitad se note ahora y no dentro de un mes.
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "$CONTENEDOR" \
  pg_restore -U "$USUARIO" -d "$BASE" --clean --if-exists --no-owner --exit-on-error \
  < "$TRABAJO/base.dump"

TABLAS_OK="$(psql_en "$BASE" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"

# ── Imágenes de producto ─────────────────────────────────────
#
# Restaurar solo la base dejaría el catálogo completo y ninguna ficha con foto,
# y además la aplicación NO ARRANCARÍA: comprueba al iniciar que las imágenes
# que la base registra existan de verdad (src/modules/storage/persistence.ts).
if [[ -s "$TRABAJO/imagenes.tar" ]]; then
  if [[ -z "$VOLUMEN_IMAGENES" ]]; then
    echo ""
    echo "⚠ El respaldo trae imágenes pero no se indicó --volumen. Sáltatelo solo si"
    echo "  el almacenamiento es remoto; si no, la aplicación no arrancará."
  else
    echo "→ Restaurando imágenes en el volumen '$VOLUMEN_IMAGENES'…"
    docker volume create "$VOLUMEN_IMAGENES" >/dev/null
    docker run --rm -i -v "$VOLUMEN_IMAGENES":/data alpine:3 \
      tar -xf - -C /data < "$TRABAJO/imagenes.tar" \
      || { echo "✖ No se pudieron restaurar las imágenes." >&2; exit 1; }

    ARCHIVOS="$(docker run --rm -v "$VOLUMEN_IMAGENES":/data:ro alpine:3 \
      sh -c 'find /data -type f | wc -l' | tr -d ' ')"
    echo "  $ARCHIVOS archivo(s) de imagen restaurados"
  fi
else
  echo "→ El respaldo no trae imágenes (almacenamiento remoto)."
fi

echo ""
echo "✓ Restaurado en '$BASE': $TABLAS_OK tabla(s)."
echo "  Comprueba antes de apuntar la aplicación aquí:"
echo "    SELECT count(*) FROM orders;"
echo "    SELECT count(*) FROM cashback_movements;"
echo "    SELECT count(*) FROM stock_movements;"
echo "    SELECT count(*) FROM product_images;   -- debe cuadrar con los archivos restaurados"
