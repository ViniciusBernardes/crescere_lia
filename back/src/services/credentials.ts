import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../db/database.js";
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

interface ConfigRow extends RowDataPacket {
  value: string;
  updated_at: Date | string;
}

function cacheKey(tenantId: string) {
  return tenantId;
}

function parseCompanyId(tenantId: string): number {
  const companyId = Number(tenantId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error("Empresa inválida");
  }
  return companyId;
}

function parseStoredCredentials(value: string): OpenAiCredentials {
  return JSON.parse(value) as OpenAiCredentials;
}

function serializeCredentials(creds: OpenAiCredentials): string {
  return JSON.stringify(creds);
}

function formatUpdatedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getOpenAiCredentials(
  tenantId: string,
): Promise<OpenAiCredentials | null> {
  const key = cacheKey(tenantId);
  if (cache.has(key)) return cache.get(key) ?? null;

  const companyId = parseCompanyId(tenantId);
  const [rows] = await getPool().execute<ConfigRow[]>(
    `SELECT value, updated_at
     FROM lia_openai_config
     WHERE company_id = ?
     LIMIT 1`,
    [companyId],
  );

  const row = rows[0];
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

export async function getOpenAiCredentialsPublic(
  tenantId: string,
): Promise<OpenAiCredentialsPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Empresa não encontrada");
  }

  const companyId = parseCompanyId(tenantId);
  const [rows] = await getPool().execute<ConfigRow[]>(
    `SELECT value, updated_at
     FROM lia_openai_config
     WHERE company_id = ?
     LIMIT 1`,
    [companyId],
  );

  const row = rows[0];
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
      updatedAt: formatUpdatedAt(row.updated_at),
    };
  } catch {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      configured: false,
      apiKeyMasked: null,
      ...DEFAULTS,
      updatedAt: formatUpdatedAt(row.updated_at),
    };
  }
}

export async function saveOpenAiCredentials(
  tenantId: string,
  input: Partial<OpenAiCredentials> & { apiKey?: string },
): Promise<OpenAiCredentialsPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Empresa não encontrada");

  const current = await getOpenAiCredentials(tenantId);
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

  const companyId = parseCompanyId(tenantId);
  const stored = serializeCredentials(next);
  await getPool().execute(
    `INSERT INTO lia_openai_config (company_id, value, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       value = VALUES(value),
       updated_at = NOW()`,
    [companyId, stored],
  );

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
