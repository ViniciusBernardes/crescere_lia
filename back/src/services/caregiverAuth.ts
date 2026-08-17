import type { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { getPool } from "../db/database.js";
import {
  isIclinicaSyncConfigured,
  forgotPatientPasswordInIclinica,
  loginPatientInIclinica,
  resetPatientPasswordInIclinica,
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

function wrapIclinicaError(error: unknown, fallback: string): never {
  const message =
    error instanceof Error ? error.message.replace(/^iClinica:\s*/i, "") : fallback;
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: unknown }).status) || 502
      : 502;
  throw Object.assign(new Error(message), {
    status: status >= 400 && status < 600 ? status : 502,
  });
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
      wrapIclinicaError(error, "Falha na autenticação.");
    }
  }

  const tenant = await resolveTenant(tenantSlug);
  const patient = await loginPatientViaDb(Number(tenant.id), normalizedEmail, password);
  if (!patient) {
    throw Object.assign(new Error("E-mail ou senha inválidos."), { status: 401 });
  }

  return patient;
}

export async function requestCaregiverPasswordReset(
  tenantSlug: string,
  email: string,
): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw Object.assign(new Error("Informe um e-mail válido."), { status: 400 });
  }

  const rhFallback =
    "Peça ao RH ou ao administrador da clínica para redefinir sua senha em Colaboradores.";

  if (!isIclinicaSyncConfigured()) {
    return {
      message: `Não foi possível enviar e-mail automático. ${rhFallback}`,
    };
  }

  try {
    return await forgotPatientPasswordInIclinica({
      company_slug: tenantSlug,
      email: normalizedEmail,
    });
  } catch (error) {
    wrapIclinicaError(error, rhFallback);
  }
}

export async function resetCaregiverPassword(payload: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<{ message: string }> {
  const email = payload.email.trim().toLowerCase();
  const token = payload.token.trim();
  const password = payload.password;
  const passwordConfirmation = payload.passwordConfirmation;

  if (!email || !token) {
    throw Object.assign(new Error("Link inválido ou expirado."), { status: 422 });
  }
  if (!password || password.length < 6) {
    throw Object.assign(new Error("A senha precisa ter pelo menos 6 caracteres."), { status: 422 });
  }
  if (password !== passwordConfirmation) {
    throw Object.assign(new Error("As senhas não coincidem."), { status: 422 });
  }

  if (!isIclinicaSyncConfigured()) {
    throw Object.assign(
      new Error("Redefinição automática indisponível. Peça ao RH/admin em Colaboradores."),
      { status: 503 },
    );
  }

  try {
    return await resetPatientPasswordInIclinica({
      email,
      token,
      password,
      password_confirmation: passwordConfirmation,
    });
  } catch (error) {
    wrapIclinicaError(error, "Não foi possível redefinir a senha.");
  }
}

