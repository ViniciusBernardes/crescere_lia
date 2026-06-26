#!/usr/bin/env bash
set -euo pipefail

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
