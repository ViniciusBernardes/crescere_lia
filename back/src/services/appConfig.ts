import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../db/database.js";
import { getTenantById } from "./tenants.js";

export const ALLOWED_IDLE_TIMEOUT_MS = [30_000, 60_000, 120_000] as const;
export type IdleTimeoutMs = (typeof ALLOWED_IDLE_TIMEOUT_MS)[number];
export const DEFAULT_IDLE_TIMEOUT_MS: IdleTimeoutMs = 30_000;

export interface AppConfigPublic {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  idleTimeoutMs: IdleTimeoutMs;
  updatedAt: string | null;
}

interface AppConfigRow extends RowDataPacket {
  idle_timeout_ms: number;
  updated_at: Date | string;
}

const cache = new Map<string, IdleTimeoutMs>();

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

export function isAllowedIdleTimeoutMs(value: unknown): value is IdleTimeoutMs {
  return (
    typeof value === "number" &&
    ALLOWED_IDLE_TIMEOUT_MS.includes(value as IdleTimeoutMs)
  );
}

export async function getIdleTimeoutMs(tenantId: string): Promise<IdleTimeoutMs> {
  const key = cacheKey(tenantId);
  if (cache.has(key)) return cache.get(key)!;

  const companyId = parseCompanyId(tenantId);
  try {
    const [rows] = await getPool().execute<AppConfigRow[]>(
      `SELECT idle_timeout_ms
       FROM lia_app_config
       WHERE company_id = ?
       LIMIT 1`,
      [companyId],
    );

    const raw = rows[0]?.idle_timeout_ms;
    const timeout = isAllowedIdleTimeoutMs(raw) ? raw : DEFAULT_IDLE_TIMEOUT_MS;
    cache.set(key, timeout);
    return timeout;
  } catch (error) {
    console.warn("[appConfig] Falha ao ler idle timeout, usando padrão:", error);
    return DEFAULT_IDLE_TIMEOUT_MS;
  }
}

export async function getAppConfigPublic(tenantId: string): Promise<AppConfigPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Empresa não encontrada");
  }

  const companyId = parseCompanyId(tenantId);
  let idleTimeoutMs: IdleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  let updatedAt: string | null = null;

  try {
    const [rows] = await getPool().execute<AppConfigRow[]>(
      `SELECT idle_timeout_ms, updated_at
       FROM lia_app_config
       WHERE company_id = ?
       LIMIT 1`,
      [companyId],
    );
    const row = rows[0];
    if (row && isAllowedIdleTimeoutMs(row.idle_timeout_ms)) {
      idleTimeoutMs = row.idle_timeout_ms;
    }
    updatedAt = formatUpdatedAt(row?.updated_at);
  } catch (error) {
    console.warn("[appConfig] Tabela indisponível, retornando padrão:", error);
  }

  cache.set(cacheKey(tenantId), idleTimeoutMs);

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    idleTimeoutMs,
    updatedAt,
  };
}

export async function saveAppConfig(
  tenantId: string,
  idleTimeoutMs: number,
): Promise<AppConfigPublic> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Empresa não encontrada");

  if (!isAllowedIdleTimeoutMs(idleTimeoutMs)) {
    throw new Error("Tempo de inatividade inválido. Use 30s, 1 minuto ou 2 minutos.");
  }

  const companyId = parseCompanyId(tenantId);

  await getPool().execute(
    `INSERT INTO lia_app_config (company_id, idle_timeout_ms, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       idle_timeout_ms = VALUES(idle_timeout_ms),
       updated_at = NOW()`,
    [companyId, idleTimeoutMs],
  );

  cache.set(cacheKey(tenantId), idleTimeoutMs);
  return getAppConfigPublic(tenantId);
}

export function clearAppConfigCache(tenantId?: string) {
  if (tenantId) {
    cache.delete(cacheKey(tenantId));
    return;
  }
  cache.clear();
}
