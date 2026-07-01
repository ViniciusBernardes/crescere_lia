#!/usr/bin/env bash
# Atualiza .env.production com OpenAI e redeploy.
# Uso na EC2:
#   export OPENAI_API_KEY="sk-proj-..."
#   bash deploy/set-openai-env.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Defina OPENAI_API_KEY antes de rodar este script."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp deploy/.env.production.example "$ENV_FILE"
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

upsert_env DOMAIN "${DOMAIN:-lia.crescere.life}"
upsert_env OPENAI_API_KEY "$OPENAI_API_KEY"
upsert_env OPENAI_MODEL "${OPENAI_MODEL:-gpt-4o-mini}"
upsert_env OPENAI_WHISPER_MODEL "${OPENAI_WHISPER_MODEL:-whisper-1}"
upsert_env OPENAI_MAX_TOKENS "${OPENAI_MAX_TOKENS:-1024}"
upsert_env OPENAI_TEMPERATURE "${OPENAI_TEMPERATURE:-0.7}"
upsert_env OPENAI_TTS_MODEL "${OPENAI_TTS_MODEL:-tts-1}"
upsert_env OPENAI_TTS_VOICE "${OPENAI_TTS_VOICE:-nova}"
upsert_env DEFAULT_TENANT_SLUG "${DEFAULT_TENANT_SLUG:-crescere}"
upsert_env DEFAULT_TENANT_NAME "${DEFAULT_TENANT_NAME:-Crescere}"

chmod +x deploy/*.sh
BRANCH="${BRANCH:-Feat_02}" ./deploy/update.sh

echo ""
echo "Health:"
curl -s "https://${DOMAIN:-lia.crescere.life}/api/health" || curl -s http://localhost/api/health
echo ""
