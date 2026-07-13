import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../db/database.js";
import { getDefaultSystemPrompt } from "../prompts/lia.js";
import type { UserProfileContext } from "../types/chat.js";
import {
  fetchIclinicaSystemPrompt,
  isIclinicaIntegrationEnabled,
} from "./iclinica.js";
import { getTenantById } from "./tenants.js";

export interface PromptConfigPublic {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  systemPrompt: string;
  isCustom: boolean;
  defaultPrompt: string;
  updatedAt: string | null;
}

const MAX_PROMPT_LENGTH = 12000;

interface PromptRow extends RowDataPacket {
  system_prompt: string;
  updated_at: Date | string;
}

const cache = new Map<string, string | null>();

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

function formatUpdatedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizePrompt(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt muito longo (máx. ${MAX_PROMPT_LENGTH} caracteres).`);
  }
  return trimmed;
}

export async function getCustomSystemPrompt(
  tenantId: string,
): Promise<string | null> {
  const key = cacheKey(tenantId);
  if (cache.has(key)) return cache.get(key) ?? null;

  const companyId = parseCompanyId(tenantId);
  const [rows] = await getPool().execute<PromptRow[]>(
    `SELECT system_prompt
     FROM lia_prompt_config
     WHERE company_id = ?
     LIMIT 1`,
    [companyId],
  );

  const row = rows[0];
  const prompt = row?.system_prompt?.trim() || null;
  cache.set(key, prompt);
  return prompt;
}

export async function resolveSystemPrompt(
  tenantId: string,
  tenantSlug?: string,
  profile?: UserProfileContext,
): Promise<string> {
  if (tenantSlug && isIclinicaIntegrationEnabled()) {
    try {
      return await fetchIclinicaSystemPrompt(tenantSlug, profile);
    } catch (error) {
      console.warn("[prompt] iClinica indisponível, usando fallback local:", error);
    }
  }

  const custom = await getCustomSystemPrompt(tenantId);
  return custom || getDefaultSystemPrompt();
}

export async function getPromptConfigPublic(
  tenantId: string,
): Promise<PromptConfigPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Empresa não encontrada");
  }

  const companyId = parseCompanyId(tenantId);
  const [rows] = await getPool().execute<PromptRow[]>(
    `SELECT system_prompt, updated_at
     FROM lia_prompt_config
     WHERE company_id = ?
     LIMIT 1`,
    [companyId],
  );

  const row = rows[0];
  const custom = row?.system_prompt?.trim() || "";
  const defaultPrompt = getDefaultSystemPrompt();

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    systemPrompt: custom || defaultPrompt,
    isCustom: custom.length > 0,
    defaultPrompt,
    updatedAt: formatUpdatedAt(row?.updated_at),
  };
}

export async function savePromptConfig(
  tenantId: string,
  systemPrompt: string,
): Promise<PromptConfigPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Empresa não encontrada");

  const companyId = parseCompanyId(tenantId);
  const normalized = normalizePrompt(systemPrompt);

  if (!normalized) {
    await getPool().execute(
      `DELETE FROM lia_prompt_config WHERE company_id = ?`,
      [companyId],
    );
    cache.set(cacheKey(tenantId), null);
    return getPromptConfigPublic(tenantId);
  }

  await getPool().execute(
    `INSERT INTO lia_prompt_config (company_id, system_prompt, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       system_prompt = VALUES(system_prompt),
       updated_at = NOW()`,
    [companyId, normalized],
  );

  cache.set(cacheKey(tenantId), normalized);
  return getPromptConfigPublic(tenantId);
}

export function clearPromptCache(tenantId?: string) {
  if (tenantId) {
    cache.delete(cacheKey(tenantId));
    return;
  }
  cache.clear();
}
