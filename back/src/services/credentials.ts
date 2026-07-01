import { getDb } from "../db/database.js";
import { maskSecret } from "./crypto.js";
import { getTenantById } from "./tenants.js";

export interface OpenAiCredentials {
  apiKey: string;
  model: string;
  whisperModel: string;
  maxTokens: number;
  temperature: number;
}

export interface OpenAiCredentialsPublic {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  configured: boolean;
  apiKeyMasked: string | null;
  model: string;
  whisperModel: string;
  maxTokens: number;
  temperature: number;
  updatedAt: string | null;
}

const DEFAULTS: Omit<OpenAiCredentials, "apiKey"> = {
  model: "gpt-4o-mini",
  whisperModel: "whisper-1",
  maxTokens: 1024,
  temperature: 0.7,
};

const cache = new Map<string, OpenAiCredentials | null>();

function cacheKey(tenantId: string) {
  return tenantId;
}

function parseStoredCredentials(value: string): OpenAiCredentials {
  return JSON.parse(value) as OpenAiCredentials;
}

function serializeCredentials(creds: OpenAiCredentials): string {
  return JSON.stringify(creds);
}

export function getOpenAiCredentials(tenantId: string): OpenAiCredentials | null {
  const key = cacheKey(tenantId);
  if (cache.has(key)) return cache.get(key) ?? null;

  const row = getDb()
    .prepare(
      "SELECT value, updated_at FROM tenant_openai_config WHERE tenant_id = ?",
    )
    .get(tenantId) as { value: string; updated_at: string } | undefined;

  if (!row) {
    cache.set(key, null);
    return null;
  }

  try {
    const parsed = parseStoredCredentials(row.value);
    const creds: OpenAiCredentials = {
      ...DEFAULTS,
      ...parsed,
      apiKey: parsed.apiKey?.trim() || "",
    };
    const result = creds.apiKey ? creds : null;
    cache.set(key, result);
    return result;
  } catch (error) {
    console.error("[credentials] Falha ao ler credenciais:", error);
    cache.set(key, null);
    return null;
  }
}

export function getOpenAiCredentialsPublic(
  tenantId: string,
): OpenAiCredentialsPublic {
  const tenant = getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Empresa não encontrada");
  }

  const row = getDb()
    .prepare(
      "SELECT value, updated_at FROM tenant_openai_config WHERE tenant_id = ?",
    )
    .get(tenantId) as { value: string; updated_at: string } | undefined;

  if (!row) {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      configured: false,
      apiKeyMasked: null,
      ...DEFAULTS,
      updatedAt: null,
    };
  }

  try {
    const parsed = parseStoredCredentials(row.value);
    const apiKey = parsed.apiKey?.trim() || "";
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      configured: apiKey.length > 0,
      apiKeyMasked: apiKey ? maskSecret(apiKey) : null,
      model: parsed.model || DEFAULTS.model,
      whisperModel: parsed.whisperModel || DEFAULTS.whisperModel,
      maxTokens: parsed.maxTokens || DEFAULTS.maxTokens,
      temperature: parsed.temperature ?? DEFAULTS.temperature,
      updatedAt: row.updated_at,
    };
  } catch {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      configured: false,
      apiKeyMasked: null,
      ...DEFAULTS,
      updatedAt: row.updated_at,
    };
  }
}

export function saveOpenAiCredentials(
  tenantId: string,
  input: Partial<OpenAiCredentials> & { apiKey?: string },
): OpenAiCredentialsPublic {
  const tenant = getTenantById(tenantId);
  if (!tenant) throw new Error("Empresa não encontrada");

  const current = getOpenAiCredentials(tenantId);
  const apiKey = input.apiKey?.trim() || current?.apiKey || "";

  if (!apiKey) {
    throw new Error("A chave da API OpenAI é obrigatória");
  }

  const next: OpenAiCredentials = {
    apiKey,
    model: input.model?.trim() || current?.model || DEFAULTS.model,
    whisperModel:
      input.whisperModel?.trim() || current?.whisperModel || DEFAULTS.whisperModel,
    maxTokens: Number(input.maxTokens) || current?.maxTokens || DEFAULTS.maxTokens,
    temperature:
      input.temperature !== undefined
        ? Number(input.temperature)
        : (current?.temperature ?? DEFAULTS.temperature),
  };

  const stored = serializeCredentials(next);
  getDb()
    .prepare(
      `INSERT INTO tenant_openai_config (tenant_id, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`,
    )
    .run(tenantId, stored);

  cache.set(cacheKey(tenantId), next);
  return getOpenAiCredentialsPublic(tenantId);
}

export function clearCredentialsCache(tenantId?: string) {
  if (tenantId) {
    cache.delete(cacheKey(tenantId));
    return;
  }
  cache.clear();
}
