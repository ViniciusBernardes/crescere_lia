import { Router } from "express";
import { fetchJourneysFromIclinica, isIclinicaSyncConfigured } from "../services/iclinicaSync.js";
import { resolveTenantSlug } from "../services/tenants.js";

export const journeysRouter = Router();

journeysRouter.get("/journeys", async (req, res) => {
  try {
    if (!isIclinicaSyncConfigured()) {
      return res.status(503).json({
        error: "integration_unavailable",
        message: "Catálogo de jornadas via iClinica não configurado.",
      });
    }

    const tenantSlug = resolveTenantSlug(req.headers["x-tenant-slug"]);
    const data = await fetchJourneysFromIclinica(tenantSlug);
    res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao buscar jornadas.";
    res.status(502).json({ error: "journeys_fetch_failed", message });
  }
});
