#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/restore-postgres.sh <backup.dump> --target-db <empty-database> --confirm-target <same-name>

Restores only into an explicitly confirmed, empty PostgreSQL database. The target must
not equal DB_DATABASE, which protects the current production database from in-place restore.
EOF
}

if [[ ${1:-} == '--help' || ${1:-} == '-h' ]]; then
  usage
  exit 0
fi

backup_path=${1:-}
if [[ -z $backup_path ]]; then
  usage >&2
  exit 2
fi
shift

target_database=''
confirmed_database=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db)
      target_database=${2:-}
      shift 2
      ;;
    --confirm-target)
      confirmed_database=${2:-}
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! -f $backup_path ]]; then
  echo "Backup does not exist: $backup_path" >&2
  exit 2
fi
if [[ -z $target_database || $confirmed_database != "$target_database" ]]; then
  echo '--target-db and --confirm-target must contain the same non-empty database name' >&2
  exit 2
fi
if [[ $target_database == "${DB_DATABASE:-diy_bracelets}" ]]; then
  echo 'Refusing an in-place restore into DB_DATABASE; restore into an isolated database first' >&2
  exit 2
fi

command -v psql >/dev/null || { echo 'psql is required' >&2; exit 1; }
command -v pg_restore >/dev/null || { echo 'pg_restore is required' >&2; exit 1; }

backup_directory=$(cd "$(dirname "$backup_path")" && pwd -P)
backup_name=$(basename "$backup_path")
backup_path="$backup_directory/$backup_name"
checksum_path="${backup_path}.sha256"
if [[ -f $checksum_path ]]; then
  if command -v sha256sum >/dev/null; then
    (cd "$backup_directory" && sha256sum --check "$(basename "$checksum_path")")
  else
    (cd "$backup_directory" && shasum -a 256 --check "$(basename "$checksum_path")")
  fi
else
  echo 'Checksum file is required next to the dump' >&2
  exit 2
fi

database_host=${DB_HOST:-localhost}
database_port=${DB_PORT:-5432}
database_user=${DB_USERNAME:-postgres}
database_ssl_mode=${DB_SSL_MODE:-disable}
postgres_env=(env "PGPASSWORD=${DB_PASSWORD:-}" "PGSSLMODE=$database_ssl_mode")
if [[ -n ${DB_SSL_CA_PATH:-} ]]; then
  postgres_env+=("PGSSLROOTCERT=$DB_SSL_CA_PATH")
fi

object_count=$("${postgres_env[@]}" psql \
  --host="$database_host" \
  --port="$database_port" \
  --username="$database_user" \
  --dbname="$target_database" \
  --tuples-only \
  --no-align \
  --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND c.relkind IN ('r', 'p', 'S', 'v', 'm');")

if [[ ${object_count//[[:space:]]/} != '0' ]]; then
  echo 'Target database is not empty; restore aborted' >&2
  exit 2
fi

"${postgres_env[@]}" pg_restore \
  --host="$database_host" \
  --port="$database_port" \
  --username="$database_user" \
  --dbname="$target_database" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-privileges \
  "$backup_path"

printf 'Restore completed into isolated database: %s\n' "$target_database"
