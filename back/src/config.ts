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

export function getOpenAiConfigForTenant(
  tenantSlug?: string,
): (OpenAiCredentials & { tenantSlug: string }) | null {
  const tenant = tenantSlug ? resolveTenant(tenantSlug) : resolveTenant();
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
