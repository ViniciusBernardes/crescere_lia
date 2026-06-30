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

const ENV_DEFAULTS: Omit<OpenAiCredentials, "apiKey"> = {
  model: "gpt-4o-mini",
  whisperModel: "whisper-1",
  maxTokens: 1024,
  temperature: 0.7,
};

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

export function getOpenAiConfigForTenant(
  tenantSlug?: string,
): (OpenAiCredentials & { tenantSlug: string }) | null {
  const envCreds = getEnvOpenAiCredentials();
  const tenant = tenantSlug ? resolveTenant(tenantSlug) : resolveTenant();

  if (envCreds) {
    return { ...envCreds, tenantSlug: tenant.slug };
  }

  const creds = getOpenAiCredentials(tenant.id);
  if (!creds) return null;
  return { ...creds, tenantSlug: tenant.slug };
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
