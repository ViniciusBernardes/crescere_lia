import { Router } from "express";
import { isIclinicaIntegrationEnabled } from "../services/iclinica.js";
import { resolveJourneysForTenant } from "../services/journeys.js";
import { fetchIclinicaSystemPrompt } from "../services/iclinica.js";
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
