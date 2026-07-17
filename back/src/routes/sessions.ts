import { Router } from "express";
import { syncCaregiverSession } from "../services/sessions.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const sessionsRouter = Router();

sessionsRouter.post("/sessions/sync", async (req, res) => {
  try {
    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const body = req.body as Record<string, unknown>;
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
    const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
    const profile =
      body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
        ? (body.profile as Record<string, unknown>)
        : {};
    const needsPsych =
      typeof body.needsPsych === "boolean" ? body.needsPsych : undefined;

    if (!sessionToken.trim()) {
      return res.status(400).json({ error: "invalid_session", message: "sessionToken é obrigatório." });
    }

    await syncCaregiverSession(tenantSlug, { sessionToken, displayName, profile, needsPsych });

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar sessão.";
    res.status(500).json({ error: "sync_failed", message });
  }
});
