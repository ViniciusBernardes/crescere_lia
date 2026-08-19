import { Router } from "express";
import { getCaregiverSession, syncCaregiverSession } from "../services/sessions.js";
import { heartbeatSession, isIclinicaSyncConfigured } from "../services/iclinicaSync.js";
import { getTenantBySlug, resolveTenantSlug } from "../services/tenants.js";

export const sessionsRouter = Router();

function sessionTokenFromRequest(req: import("express").Request): string {
  const header = req.headers["x-lia-session-token"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  const query = req.query.session_token;
  if (typeof query === "string" && query.trim()) {
    return query.trim();
  }
  return "";
}

sessionsRouter.get("/sessions/me", async (req, res) => {
  try {
    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const sessionToken = sessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(400).json({ error: "missing_session_token" });
    }

    const snapshot = await getCaregiverSession(tenantSlug, sessionToken);
    if (!snapshot) {
      return res.status(404).json({ error: "session_not_found" });
    }

    return res.json({
      displayName: snapshot.displayName,
      patientId: snapshot.patientId,
      needsPsych: snapshot.needsPsych,
      profile: snapshot.profile,
      stats: snapshot.stats,
      tags: snapshot.tags,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar sessão.";
    return res.status(500).json({ error: "session_load_failed", message });
  }
});

/**
 * Lightweight heartbeat — only refreshes last_activity_at to keep the session
 * alive in the queue without sending the full profile payload.
 */
sessionsRouter.post("/sessions/heartbeat", async (req, res) => {
  try {
    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const body = req.body as Record<string, unknown>;
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";

    if (!sessionToken) {
      return res.status(400).json({ error: "missing_session_token" });
    }

    if (!isIclinicaSyncConfigured()) {
      return res.json({ ok: true });
    }

    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    await heartbeatSession(tenant.slug, sessionToken);
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no heartbeat.";
    return res.status(500).json({ error: "heartbeat_failed", message });
  }
});

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
    const patientId =
      typeof body.patientId === "number"
        ? body.patientId
        : body.patientId === null
          ? null
          : undefined;
    const fcmToken = typeof body.fcmToken === "string" && body.fcmToken.trim()
      ? body.fcmToken.trim()
      : undefined;

    if (!sessionToken.trim()) {
      return res.status(400).json({ error: "invalid_session", message: "sessionToken é obrigatório." });
    }

    await syncCaregiverSession(tenantSlug, {
      sessionToken,
      displayName,
      profile,
      needsPsych,
      patientId,
      fcmToken,
    });

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar sessão.";
    res.status(500).json({ error: "sync_failed", message });
  }
});
