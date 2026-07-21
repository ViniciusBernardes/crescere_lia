import { Router } from "express";
import { authenticateCaregiver } from "../services/caregiverAuth.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const authRouter = Router();

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
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: unknown }).status) || 500
        : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "auth_failed",
      message,
    });
  }
});
