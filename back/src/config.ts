import {
  getOpenAiCredentials,
  type OpenAiCredentials,
} from "./services/credentials.js";
import { resolveTenant, resolveTenantSlug } from "./services/tenants.js";

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
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

export async function getOpenAiCredentialsSource(
  tenantSlug?: string,
): Promise<"env" | "database" | null> {
  const tenant = tenantSlug
    ? await resolveTenant(tenantSlug)
    : await resolveTenant();
  const creds = await getOpenAiCredentials(tenant.id);
  if (creds?.apiKey) return "database";
  if (getEnvOpenAiCredentials()) return "env";
  return null;
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

export async function getOpenAiConfigForTenant(
  tenantSlug?: string,
): Promise<(OpenAiRuntimeSettings & { tenantSlug: string }) | null> {
  const tenant = tenantSlug
    ? await resolveTenant(tenantSlug)
    : await resolveTenant();

  const creds = await getOpenAiCredentials(tenant.id);
  if (creds?.apiKey) {
    return withTtsSettings(creds, tenant.slug);
  }

  const envCreds = getEnvOpenAiCredentials();
  if (envCreds) {
    return withTtsSettings(envCreds, tenant.slug);
  }

  return null;
}

export async function isOpenAiConfigured(tenantSlug?: string): Promise<boolean> {
  try {
    const settings = await getOpenAiConfigForTenant(tenantSlug);
    return Boolean(settings?.apiKey);
  } catch {
    return false;
  }
}

export async function resolveOpenAiSettings(tenantSlug?: string) {
  return getOpenAiConfigForTenant(tenantSlug);
}
