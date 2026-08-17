import { Router } from "express";
import {
  authenticateCaregiver,
  requestCaregiverPasswordReset,
  resetCaregiverPassword,
} from "../services/caregiverAuth.js";
import {
  isIclinicaSyncConfigured,
  registerPatientInIclinica,
} from "../services/iclinicaSync.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const authRouter = Router();

function errorStatus(error: unknown): number {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: unknown }).status) || 500
      : 500;
  return status >= 400 && status < 600 ? status : 500;
}

function authError(
  res: import("express").Response,
  error: unknown,
  fallback: string,
  code = "auth_failed",
) {
  const message =
    error instanceof Error
      ? error.message.replace(/^iClinica:\s*/i, "")
      : fallback;
  return res.status(errorStatus(error)).json({
    error: code,
    message,
  });
}

authRouter.post("/auth/login", async (req, res) => {
  try {
    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    const patient = await authenticateCaregiver(tenantSlug, email, password);

    res.json({
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
      },
    });
  } catch (error) {
    return authError(res, error, "Falha ao autenticar.");
  }
});

authRouter.post("/auth/register", async (req, res) => {
  try {
    if (!isIclinicaSyncConfigured()) {
      return res.status(503).json({
        error: "integration_not_configured",
        message: "Cadastro depende da integração com o Crescere.",
      });
    }

    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation =
      typeof body.password_confirmation === "string"
        ? body.password_confirmation
        : password;
    const profileType =
      typeof body.profile_type === "string" ? body.profile_type : undefined;

    const patient = await registerPatientInIclinica({
      company_slug: tenantSlug,
      name,
      email,
      password,
      password_confirmation: confirmation,
      profile_type: profileType,
    });

    res.json({
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
      },
    });
  } catch (error) {
    return authError(res, error, "Falha ao cadastrar.");
  }
});

authRouter.post("/auth/forgot", async (req, res) => {
  try {
    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";

    const result = await requestCaregiverPasswordReset(tenantSlug, email);
    res.json(result);
  } catch (error) {
    return authError(res, error, "Falha ao solicitar redefinição.", "forgot_failed");
  }
});

authRouter.post("/auth/reset", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await resetCaregiverPassword({
      email: typeof body.email === "string" ? body.email : "",
      token: typeof body.token === "string" ? body.token : "",
      password: typeof body.password === "string" ? body.password : "",
      passwordConfirmation:
        typeof body.password_confirmation === "string"
          ? body.password_confirmation
          : typeof body.passwordConfirmation === "string"
            ? body.passwordConfirmation
            : "",
    });
    res.json(result);
  } catch (error) {
    return authError(res, error, "Falha ao redefinir senha.", "reset_failed");
  }
});
