import type { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { getPool } from "../db/database.js";
import {
  isIclinicaSyncConfigured,
  loginPatientInIclinica,
} from "./iclinicaSync.js";
import { resolveTenant } from "./tenants.js";

export type CaregiverAuthResult = {
  id: number;
  name: string;
  email: string;
};

async function verifyLaravelPassword(plain: string, hash: string): Promise<boolean> {
  const normalized = hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
  return bcrypt.compare(plain, normalized);
}

async function loginPatientViaDb(
  companyId: number,
  email: string,
  password: string,
): Promise<CaregiverAuthResult | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, email, password
     FROM patients
     WHERE company_id = ?
       AND active = 1
       AND password IS NOT NULL
       AND LOWER(email) = ?
     LIMIT 1`,
    [companyId, email],
  );

  const row = rows[0];
  if (!row?.password) return null;

  const ok = await verifyLaravelPassword(password, String(row.password));
  if (!ok) return null;

  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
  };
}

export async function authenticateCaregiver(
  tenantSlug: string,
  email: string,
  password: string,
): Promise<CaregiverAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw Object.assign(new Error("E-mail e senha são obrigatórios."), { status: 400 });
  }

  if (isIclinicaSyncConfigured()) {
    try {
      return await loginPatientInIclinica({
        company_slug: tenantSlug,
        email: normalizedEmail,
        password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^iClinica:\s*/i, "") : "Falha na autenticação.";
      const status =
        typeof error === "object" && error && "status" in error
          ? Number((error as { status: unknown }).status) || 502
          : 502;
      throw Object.assign(new Error(message), { status: status === 401 ? 401 : status });
    }
  }

  const tenant = await resolveTenant(tenantSlug);
  const patient = await loginPatientViaDb(Number(tenant.id), normalizedEmail, password);
  if (!patient) {
    throw Object.assign(new Error("E-mail ou senha inválidos."), { status: 401 });
  }

  return patient;
}
