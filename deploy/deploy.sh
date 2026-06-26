#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
source "$ROOT_DIR/deploy/lib.sh"

ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo $ENV_FILE não encontrado."
  echo "Copie o exemplo: cp deploy/.env.production.example .env.production"
  exit 1
fi

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
