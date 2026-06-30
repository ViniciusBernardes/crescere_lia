#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
source "$ROOT_DIR/deploy/lib.sh"

ENV_FILE="${ENV_FILE:-.env.production}"

ensure_production_env "$ENV_FILE"

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${DOMAIN:-}" ]]; then
  echo "Defina DOMAIN em $ENV_FILE"
  exit 1
fi

echo "==> Deploy Crescere LIA (${DOMAIN})"
docker_compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build --remove-orphans

echo ""
echo "Deploy concluído."
echo "  App:  https://${DOMAIN}"
echo "  API:  https://${DOMAIN}/api/health"
docker_compose -f docker-compose.prod.yml ps
