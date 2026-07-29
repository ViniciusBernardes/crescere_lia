import { Router } from "express";
import {
  authenticateCaregiver,
  requestCaregiverPasswordReset,
  resetCaregiverPassword,
} from "../services/caregiverAuth.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const authRouter = Router();

function errorStatus(error: unknown): number {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: unknown }).status) || 500
      : 500;
  return status >= 400 && status < 600 ? status : 500;
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
    const message = error instanceof Error ? error.message : "Falha ao autenticar.";
    res.status(errorStatus(error)).json({
      error: "auth_failed",
      message,
    });
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
    const message = error instanceof Error ? error.message : "Falha ao solicitar redefinição.";
    res.status(errorStatus(error)).json({
      error: "forgot_failed",
      message,
    });
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
    const message = error instanceof Error ? error.message : "Falha ao redefinir senha.";
    res.status(errorStatus(error)).json({
      error: "reset_failed",
      message,
    });
  }
});
