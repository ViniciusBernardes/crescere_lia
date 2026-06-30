#!/usr/bin/env bash
set -euo pipefail

ensure_production_env() {
  local env_file="${1:-.env.production}"

  if [[ ! -f "$env_file" ]]; then
    cp deploy/.env.production.example "$env_file"
  fi

  if ! grep -q '^DOMAIN=' "$env_file" || grep -q '^DOMAIN=$' "$env_file"; then
    echo "DOMAIN=lia.crescere.life" >> "$env_file"
  fi
}

docker_compose() {
  if docker compose version &>/dev/null; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    echo "Docker Compose não encontrado. Instale com: sudo bash deploy/install-docker.sh"
    exit 1
  fi
}
