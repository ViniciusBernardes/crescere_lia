import { Router } from "express";
import { isIclinicaIntegrationEnabled } from "../services/iclinica.js";
import { resolveJourneysForTenant } from "../services/journeys.js";
import { fetchIclinicaSystemPrompt } from "../services/iclinica.js";
import {
  fetchLibraryFromIclinica,
  fetchProfessionalsFromIclinica,
  isIclinicaSyncConfigured,
} from "../services/iclinicaSync.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const iclinicaRouter = Router();

function tenantFromRequest(req: import("express").Request): string {
  return resolveTenantSlug(req.headers["x-tenant-slug"]);
}

iclinicaRouter.get("/journeys", async (req, res) => {
  const tenantSlug = tenantFromRequest(req);

  try {
    const result = await resolveJourneysForTenant(tenantSlug);
    return res.json({
      tenant: tenantSlug,
      source: result.source,
      integration_enabled: isIclinicaIntegrationEnabled(),
      journeys: result.journeys,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar jornadas.";
    return res.status(502).json({ error: "journeys_error", message });
  }
});

iclinicaRouter.get("/lia-context", async (req, res) => {
  const tenantSlug = tenantFromRequest(req);

  try {
    const journeysResult = await resolveJourneysForTenant(tenantSlug);
    let systemPrompt: string | null = null;

    if (isIclinicaIntegrationEnabled()) {
      try {
        systemPrompt = await fetchIclinicaSystemPrompt(tenantSlug);
      } catch (error) {
        console.warn("[lia-context] prompt iClinica indisponível:", error);
      }
    }

    return res.json({
      tenant: tenantSlug,
      integration_enabled: isIclinicaIntegrationEnabled(),
      journeys_source: journeysResult.source,
      system_prompt_available: Boolean(systemPrompt),
      system_prompt_length: systemPrompt?.length ?? 0,
      journeys_count: journeysResult.journeys.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar contexto.";
    return res.status(502).json({ error: "context_error", message });
  }
});

iclinicaRouter.get("/professionals", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.status(503).json({
      error: "integration_not_configured",
      message: "Catálogo de profissionais depende da integração com o Crescere.",
    });
  }

  try {
    const tenantSlug = tenantFromRequest(req);
    const data = await fetchProfessionalsFromIclinica(tenantSlug);
    return res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar profissionais.";
    return res.status(502).json({ error: "professionals_error", message });
  }
});

iclinicaRouter.get("/library", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.status(503).json({
      error: "integration_not_configured",
      message: "Biblioteca depende da integração com o Crescere.",
    });
  }

  try {
    const tenantSlug = tenantFromRequest(req);
    const data = await fetchLibraryFromIclinica(tenantSlug);
    return res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar a biblioteca.";
    return res.status(502).json({ error: "library_error", message });
  }
});
