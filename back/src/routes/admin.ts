import { Router } from "express";
import {
  createSessionToken,
  isAdminAuthConfigured,
  requireAdmin,
  validateAdminLogin,
  verifySessionToken,
} from "../middleware/adminAuth.js";
import {
  config,
  getOpenAiCredentialsSource,
  isOpenAiConfigured,
  resolveOpenAiSettings,
} from "../config.js";
import {
  getOpenAiCredentialsPublic,
  importEnvOpenAiCredentials,
  saveOpenAiCredentials,
} from "../services/credentials.js";
import {
  getPromptConfigPublic,
  savePromptConfig,
} from "../services/promptConfig.js";
import {
  getAppConfigPublic,
  isAllowedIdleTimeoutMs,
  saveAppConfig,
} from "../services/appConfig.js";
import {
  createTenant,
  getTenantBySlug,
  listTenants,
  resolveTenant,
} from "../services/tenants.js";

export const adminRouter = Router();

adminRouter.post("/login", (req, res) => {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      error: "admin_not_configured",
      message:
        "Painel admin não configurado. Defina ADMIN_USERNAME e ADMIN_PASSWORD no servidor.",
    });
  }

  const body = req.body as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return res.status(400).json({
      error: "invalid_credentials",
      message: "Informe usuário e senha.",
    });
  }

  if (!validateAdminLogin(username, password)) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Usuário ou senha inválidos.",
    });
  }

  res.json({
    ok: true,
    token: createSessionToken(username),
    username,
  });
});

adminRouter.use(requireAdmin);

adminRouter.get("/session", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const username = token ? verifySessionToken(token) : null;

  if (!username) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Sessão expirada.",
    });
  }

  res.json({ ok: true, username });
});

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

adminRouter.post("/tenants/:slug/openai/import-env", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }

  try {
    const result = await importEnvOpenAiCredentials(tenant.id);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível importar.";
    res.status(400).json({ error: "import_failed", message });
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

adminRouter.get("/tenants/:slug/prompt", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }
  res.json(await getPromptConfigPublic(tenant.id));
});

adminRouter.put("/tenants/:slug/prompt", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }

  const body = req.body as Record<string, unknown>;
  const systemPrompt =
    typeof body.systemPrompt === "string" ? body.systemPrompt : "";

  try {
    const result = await savePromptConfig(tenant.id, systemPrompt);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível salvar o prompt.";
    res.status(400).json({ error: "save_failed", message });
  }
});

adminRouter.get("/tenants/:slug/app-config", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }
  res.json(await getAppConfigPublic(tenant.id));
});

adminRouter.put("/tenants/:slug/app-config", async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({
      error: "tenant_not_found",
      message: "Empresa não encontrada.",
    });
  }

  const body = req.body as Record<string, unknown>;
  const idleTimeoutMs =
    typeof body.idleTimeoutMs === "number"
      ? body.idleTimeoutMs
      : Number(body.idleTimeoutMs);

  if (!isAllowedIdleTimeoutMs(idleTimeoutMs)) {
    return res.status(400).json({
      error: "invalid_idle_timeout",
      message: "Escolha 30 segundos, 1 minuto ou 2 minutos.",
    });
  }

  try {
    const result = await saveAppConfig(tenant.id, idleTimeoutMs);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a configuração.";
    res.status(400).json({ error: "save_failed", message });
  }
});
