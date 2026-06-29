import { randomUUID } from "node:crypto";
import { getDb } from "../db/database.js";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG?.trim() || "crescere";
const DEFAULT_NAME = process.env.DEFAULT_TENANT_NAME?.trim() || "Crescere";

export function ensureDefaultTenant(): Tenant {
  const existing = getTenantBySlug(DEFAULT_SLUG);
  if (existing) return existing;

  const tenant: Tenant = {
    id: randomUUID(),
    name: DEFAULT_NAME,
    slug: DEFAULT_SLUG,
    createdAt: new Date().toISOString(),
  };

  getDb()
    .prepare("INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)")
    .run(tenant.id, tenant.name, tenant.slug);

  return tenant;
}

export function listTenants(): Tenant[] {
  return getDb()
    .prepare("SELECT id, name, slug, created_at as createdAt FROM tenants ORDER BY name")
    .all() as Tenant[];
}

export function getTenantBySlug(slug: string): Tenant | null {
  const row = getDb()
    .prepare(
      "SELECT id, name, slug, created_at as createdAt FROM tenants WHERE slug = ?",
    )
    .get(slug) as Tenant | undefined;
  return row ?? null;
}

export function getTenantById(id: string): Tenant | null {
  const row = getDb()
    .prepare(
      "SELECT id, name, slug, created_at as createdAt FROM tenants WHERE id = ?",
    )
    .get(id) as Tenant | undefined;
  return row ?? null;
}

export function createTenant(name: string, slug: string): Tenant {
  const cleanName = name.trim();
  const cleanSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanName) throw new Error("Nome da empresa é obrigatório");
  if (!cleanSlug) throw new Error("Identificador (slug) é obrigatório");

  const exists = getTenantBySlug(cleanSlug);
  if (exists) throw new Error("Já existe uma empresa com este identificador");

  const tenant: Tenant = {
    id: randomUUID(),
    name: cleanName,
    slug: cleanSlug,
    createdAt: new Date().toISOString(),
  };

  getDb()
    .prepare("INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)")
    .run(tenant.id, tenant.name, tenant.slug);

  return tenant;
}

export function resolveTenantSlug(headerValue?: string | string[]): string {
  const fromHeader = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue?.trim();
  if (fromHeader) return fromHeader.toLowerCase();
  return DEFAULT_SLUG;
}

export function resolveTenant(headerValue?: string | string[]): Tenant {
  const slug = resolveTenantSlug(headerValue);
  const tenant = getTenantBySlug(slug);
  if (!tenant) {
    throw new Error(`Empresa não encontrada: ${slug}`);
  }
  return tenant;
}
