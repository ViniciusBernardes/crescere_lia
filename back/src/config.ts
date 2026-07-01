import {
  getOpenAiCredentials,
  type OpenAiCredentials,
} from "./services/credentials.js";
import { resolveTenant, resolveTenantSlug } from "./services/tenants.js";

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  dataDir: process.env.DATA_DIR || "data",
  defaultTenantSlug: resolveTenantSlug(),
};

export type OpenAiTtsVoice =
  | "alloy"
  | "ash"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer";

export interface OpenAiRuntimeSettings extends OpenAiCredentials {
  ttsModel: string;
  ttsVoice: OpenAiTtsVoice;
}

const ENV_DEFAULTS: Omit<OpenAiCredentials, "apiKey"> = {
  model: "gpt-4o-mini",
  whisperModel: "whisper-1",
  maxTokens: 1024,
  temperature: 0.7,
};

const TTS_DEFAULTS = {
  model: "tts-1",
  voice: "nova" as OpenAiTtsVoice,
};

const TTS_VOICES = new Set<OpenAiTtsVoice>([
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

function parseTtsVoice(value: string | undefined): OpenAiTtsVoice {
  const voice = value?.trim().toLowerCase() as OpenAiTtsVoice;
  return TTS_VOICES.has(voice) ? voice : TTS_DEFAULTS.voice;
}

function getEnvOpenAiCredentials(): OpenAiCredentials | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || ENV_DEFAULTS.model,
    whisperModel:
      process.env.OPENAI_WHISPER_MODEL?.trim() || ENV_DEFAULTS.whisperModel,
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || ENV_DEFAULTS.maxTokens,
    temperature:
      process.env.OPENAI_TEMPERATURE !== undefined
        ? Number(process.env.OPENAI_TEMPERATURE)
        : ENV_DEFAULTS.temperature,
  };
}

export function getOpenAiCredentialsSource(
  tenantSlug?: string,
): "env" | "database" | null {
  if (getEnvOpenAiCredentials()) return "env";
  const tenant = tenantSlug ? resolveTenant(tenantSlug) : resolveTenant();
  const creds = getOpenAiCredentials(tenant.id);
  return creds?.apiKey ? "database" : null;
}

function withTtsSettings(
  creds: OpenAiCredentials,
  tenantSlug: string,
): OpenAiRuntimeSettings & { tenantSlug: string } {
  return {
    ...creds,
    tenantSlug,
    ttsModel: process.env.OPENAI_TTS_MODEL?.trim() || TTS_DEFAULTS.model,
    ttsVoice: parseTtsVoice(process.env.OPENAI_TTS_VOICE),
  };
}

export function getOpenAiConfigForTenant(
  tenantSlug?: string,
): (OpenAiRuntimeSettings & { tenantSlug: string }) | null {
  const envCreds = getEnvOpenAiCredentials();
  const tenant = tenantSlug ? resolveTenant(tenantSlug) : resolveTenant();

  if (envCreds) {
    return withTtsSettings(envCreds, tenant.slug);
  }

  const creds = getOpenAiCredentials(tenant.id);
  if (!creds) return null;
  return withTtsSettings(creds, tenant.slug);
}

export function isOpenAiConfigured(tenantSlug?: string): boolean {
  try {
    return Boolean(getOpenAiConfigForTenant(tenantSlug)?.apiKey);
  } catch {
    return false;
  }
}

export function resolveOpenAiSettings(tenantSlug?: string) {
  return getOpenAiConfigForTenant(tenantSlug);
}
