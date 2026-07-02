import { Router } from "express";
import {
  config,
  getOpenAiCredentialsSource,
  isOpenAiConfigured,
  resolveOpenAiSettings,
} from "../config.js";
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

adminRouter.get("/tenants", async (_req, res) => {
  try {
    const tenants = await listTenants();
    res.json({ tenants });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível listar empresas.";
    res.status(503).json({ error: "database_error", message });
  }
});

adminRouter.post("/tenants", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const tenant = await createTenant(
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

adminRouter.get("/tenants/:slug/openai", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }
  res.json(await getOpenAiCredentialsPublic(tenant.id));
});

adminRouter.put("/tenants/:slug/openai", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }

  try {
    const result = await saveOpenAiCredentials(
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

adminRouter.get("/openai", async (_req, res) => {
  const tenant = await resolveTenant(config.defaultTenantSlug);
  res.json(await getOpenAiCredentialsPublic(tenant.id));
});

adminRouter.put("/openai", async (req, res) => {
  const tenant = await resolveTenant(config.defaultTenantSlug);
  try {
    const result = await saveOpenAiCredentials(
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

adminRouter.get("/status", async (_req, res) => {
  const tenant = await resolveTenant(config.defaultTenantSlug);
  const settings = await resolveOpenAiSettings(tenant.slug);
  res.json({
    defaultTenant: tenant.slug,
    openai: (await isOpenAiConfigured(tenant.slug)) ? "configured" : "missing_key",
    model: settings?.model ?? null,
    credentialsSource: (await getOpenAiCredentialsSource(tenant.slug)) ?? "none",
  });
});
