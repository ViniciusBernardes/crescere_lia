import { Router } from "express";
import { config, getOpenAiCredentialsSource, isOpenAiConfigured, resolveOpenAiSettings } from "../config.js";
import {
  getOpenAiCredentialsPublic,
  saveOpenAiCredentials,
} from "../services/credentials.js";
import {
  createTenant,
  getTenantBySlug,
  listTenants,
  resolveTenant,
} from "../services/tenants.js";

export const adminRouter = Router();

adminRouter.post("/verify", (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get("/tenants", (_req, res) => {
  res.json({ tenants: listTenants() });
});

adminRouter.post("/tenants", (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const tenant = createTenant(
      typeof body.name === "string" ? body.name : "",
      typeof body.slug === "string" ? body.slug : "",
    );
    res.status(201).json({ tenant });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível criar a empresa.";
    res.status(400).json({ error: "create_failed", message });
  }
});

function parseOpenAiBody(body: Record<string, unknown>) {
  return {
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    whisperModel:
      typeof body.whisperModel === "string" ? body.whisperModel : undefined,
    maxTokens:
      body.maxTokens !== undefined ? Number(body.maxTokens) : undefined,
    temperature:
      body.temperature !== undefined ? Number(body.temperature) : undefined,
  };
}

adminRouter.get("/tenants/:slug/openai", (req, res) => {
  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }
  res.json(getOpenAiCredentialsPublic(tenant.id));
});

adminRouter.put("/tenants/:slug/openai", (req, res) => {
  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }

  try {
    const result = saveOpenAiCredentials(
      tenant.id,
      parseOpenAiBody(req.body as Record<string, unknown>),
    );
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível salvar.";
    res.status(400).json({ error: "save_failed", message });
  }
});

adminRouter.get("/openai", (_req, res) => {
  const tenant = resolveTenant(config.defaultTenantSlug);
  res.json(getOpenAiCredentialsPublic(tenant.id));
});

adminRouter.put("/openai", (req, res) => {
  const tenant = resolveTenant(config.defaultTenantSlug);
  try {
    const result = saveOpenAiCredentials(
      tenant.id,
      parseOpenAiBody(req.body as Record<string, unknown>),
    );
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível salvar.";
    res.status(400).json({ error: "save_failed", message });
  }
});

adminRouter.get("/status", (_req, res) => {
  const tenant = resolveTenant(config.defaultTenantSlug);
  const settings = resolveOpenAiSettings(tenant.slug);
  res.json({
    defaultTenant: tenant.slug,
    openai: isOpenAiConfigured(tenant.slug) ? "configured" : "missing_key",
    model: settings?.model ?? null,
    credentialsSource: getOpenAiCredentialsSource(tenant.slug) ?? "none",
  });
});
