#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/backup-postgres.sh <backup-directory>

Reads DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE,
DB_SSL_MODE and DB_SSL_CA_PATH. Creates a private custom-format dump and SHA-256 file.
The script never deletes older backups.
EOF
}

if [[ ${1:-} == '--help' || ${1:-} == '-h' ]]; then
  usage
  exit 0
fi

backup_directory=${1:-}
if [[ -z $backup_directory ]]; then
  usage >&2
  exit 2
fi

command -v pg_dump >/dev/null || { echo 'pg_dump is required' >&2; exit 1; }
mkdir -p -- "$backup_directory"
backup_directory=$(cd "$backup_directory" && pwd -P)
if [[ $backup_directory == '/' ]]; then
  echo 'Refusing to write backups into /' >&2
  exit 2
fi

database_host=${DB_HOST:-localhost}
database_port=${DB_PORT:-5432}
database_user=${DB_USERNAME:-postgres}
database_name=${DB_DATABASE:-diy_bracelets}
database_ssl_mode=${DB_SSL_MODE:-disable}
timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
backup_path="$backup_directory/${database_name}_${timestamp}_${RANDOM}.dump"
partial_path="${backup_path}.partial"
checksum_path="${backup_path}.sha256"
umask 077

cleanup() {
  if [[ -f $partial_path ]]; then rm -f -- "$partial_path"; fi
}
trap cleanup EXIT

postgres_env=(env "PGPASSWORD=${DB_PASSWORD:-}" "PGSSLMODE=$database_ssl_mode")
if [[ -n ${DB_SSL_CA_PATH:-} ]]; then
  postgres_env+=("PGSSLROOTCERT=$DB_SSL_CA_PATH")
fi

"${postgres_env[@]}" pg_dump \
  --host="$database_host" \
  --port="$database_port" \
  --username="$database_user" \
  --dbname="$database_name" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$partial_path"

mv -- "$partial_path" "$backup_path"
if command -v sha256sum >/dev/null; then
  (cd "$backup_directory" && sha256sum "$(basename "$backup_path")") > "$checksum_path"
else
  (cd "$backup_directory" && shasum -a 256 "$(basename "$backup_path")") > "$checksum_path"
fi

printf 'Backup created: %s\nChecksum: %s\n' "$backup_path" "$checksum_path"
