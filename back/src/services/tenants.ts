import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../db/database.js";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface CompanyRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string | null;
  created_at: Date | string;
}

const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG?.trim() || "crescere";
const DEFAULT_NAME = process.env.DEFAULT_TENANT_NAME?.trim() || "Crescere";

function mapCompany(row: CompanyRow): Tenant {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug?.trim() || String(row.id),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function ensureDefaultTenant(): Promise<Tenant> {
  const existing = await getTenantBySlug(DEFAULT_SLUG);
  if (existing) return existing;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO companies (person_type, name, slug, plan_type, active, created_at, updated_at)
     VALUES ('juridica', ?, ?, 'teste', 1, NOW(), NOW())`,
    [DEFAULT_NAME, DEFAULT_SLUG],
  );

  const created = await getTenantById(String(result.insertId));
  if (!created) {
    throw new Error("Não foi possível criar a empresa padrão da Lia");
  }

  return created;
}

export async function listTenants(): Promise<Tenant[]> {
  const [rows] = await getPool().execute<CompanyRow[]>(
    `SELECT id, name, slug, created_at
     FROM companies
     WHERE active = 1
     ORDER BY name`,
  );
  return rows.map(mapCompany);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const cleanSlug = slug.trim().toLowerCase();
  const [rows] = await getPool().execute<CompanyRow[]>(
    `SELECT id, name, slug, created_at
     FROM companies
     WHERE slug = ? AND active = 1
     LIMIT 1`,
    [cleanSlug],
  );
  return rows[0] ? mapCompany(rows[0]) : null;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const companyId = Number(id);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;

  const [rows] = await getPool().execute<CompanyRow[]>(
    `SELECT id, name, slug, created_at
     FROM companies
     WHERE id = ? AND active = 1
     LIMIT 1`,
    [companyId],
  );
  return rows[0] ? mapCompany(rows[0]) : null;
}

export async function createTenant(name: string, slug: string): Promise<Tenant> {
  const cleanName = name.trim();
  const cleanSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanName) throw new Error("Nome da empresa é obrigatório");
  if (!cleanSlug) throw new Error("Identificador (slug) é obrigatório");

  const exists = await getTenantBySlug(cleanSlug);
  if (exists) throw new Error("Já existe uma empresa com este identificador");

  await getPool().execute(
    `INSERT INTO companies (person_type, name, slug, plan_type, active, created_at, updated_at)
     VALUES ('juridica', ?, ?, 'teste', 1, NOW(), NOW())`,
    [cleanName, cleanSlug],
  );

  const tenant = await getTenantBySlug(cleanSlug);
  if (!tenant) {
    throw new Error("Não foi possível criar a empresa");
  }

  return tenant;
}

export function resolveTenantSlug(headerValue?: string | string[]): string {
  const fromHeader = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue?.trim();
  if (fromHeader) return fromHeader.toLowerCase();
  return DEFAULT_SLUG;
}

export async function resolveTenant(
  headerValue?: string | string[],
): Promise<Tenant> {
  const slug = resolveTenantSlug(headerValue);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    throw new Error(`Empresa não encontrada: ${slug}`);
  }
  return tenant;
}
