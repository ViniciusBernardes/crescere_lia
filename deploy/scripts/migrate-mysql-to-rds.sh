#!/usr/bin/env bash
# Migra dados do MySQL Docker (telemedicina) para Amazon RDS.
# Execute na EC2 do telemedicina, a partir do repo telemedicina/back.
#
# Uso:
#   export RDS_HOST=crescere-shared.xxxxx.us-east-2.rds.amazonaws.com
#   export RDS_USER=crescere_app
#   export RDS_PASSWORD='senha'
#   export RDS_DATABASE=crescere_shared
#   bash migrate-mysql-to-rds.sh
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.prod.yml}"
DUMP_PATH="${DUMP_PATH:-/tmp/crescere_dump.sql}"

: "${RDS_HOST:?Defina RDS_HOST}"
: "${RDS_USER:?Defina RDS_USER}"
: "${RDS_PASSWORD:?Defina RDS_PASSWORD}"
: "${RDS_DATABASE:=crescere_shared}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Execute a partir de telemedicina/back (compose: $COMPOSE_FILE)"
  exit 1
fi

echo "==> Exportando do MySQL Docker..."
set -a
# shellcheck disable=SC1091
source <(grep -E '^DB_(USERNAME|PASSWORD|DATABASE)=' .env)
set +a

docker exec -e MYSQL_PWD="$DB_PASSWORD" deploy-db-1 \
  mysqldump -u"$DB_USERNAME" "$DB_DATABASE" \
    --single-transaction --routines --triggers --no-tablespaces \
  > "$DUMP_PATH"

echo "==> Dump salvo em $DUMP_PATH ($(wc -c < "$DUMP_PATH") bytes)"

echo "==> Testando conexão com RDS..."
mysql -h "$RDS_HOST" -u "$RDS_USER" -p"$RDS_PASSWORD" -e "SELECT 1" "$RDS_DATABASE"

echo "==> Importando para RDS ($RDS_DATABASE)..."
mysql -h "$RDS_HOST" -u "$RDS_USER" -p"$RDS_PASSWORD" "$RDS_DATABASE" < "$DUMP_PATH"

echo "==> Concluído."
echo "Atualize DB_HOST nos .env do telemedicina e da LIA para: $RDS_HOST"
echo "Database: $RDS_DATABASE"
