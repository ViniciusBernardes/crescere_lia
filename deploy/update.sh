#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
source "$ROOT_DIR/deploy/lib.sh"

ENV_FILE="${ENV_FILE:-.env.production}"

echo "==> Atualizando código..."
git pull --ff-only origin "${BRANCH:-Feat_01}"

echo "==> Rebuild e restart..."
docker_compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build --remove-orphans

echo "==> Pronto."
docker_compose -f docker-compose.prod.yml ps
