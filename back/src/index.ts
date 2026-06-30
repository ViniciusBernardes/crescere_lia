import "dotenv/config";
import cors from "cors";
import express from "express";
import { config, getOpenAiCredentialsSource, isOpenAiConfigured, resolveOpenAiSettings } from "./config.js";
import { getDb } from "./db/database.js";
import { adminRouter } from "./routes/admin.js";
import { chatRouter } from "./routes/chat.js";
import { resolveTenant } from "./services/tenants.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

getDb();

app.get("/api/health", (_req, res) => {
  const tenant = resolveTenant(config.defaultTenantSlug);
  const settings = resolveOpenAiSettings(tenant.slug);
  res.json({
    status: "ok",
    message: "Crescere LIA API",
    tenant: tenant.slug,
    openai: isOpenAiConfigured(tenant.slug) ? "configured" : "missing_key",
    model: settings?.model ?? null,
    credentialsSource: getOpenAiCredentialsSource(tenant.slug) ?? "none",
  });
});

app.use("/api/admin", adminRouter);
app.use("/api", chatRouter);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${config.port}`);
  const tenant = resolveTenant(config.defaultTenantSlug);
  if (!isOpenAiConfigured(tenant.slug)) {
    console.warn(
      `OpenAI não configurada — defina OPENAI_API_KEY no .env ou cadastre em /admin`,
    );
    return;
  }
  const settings = resolveOpenAiSettings(tenant.slug);
  if (getOpenAiCredentialsSource(tenant.slug) === "env") {
    console.log(`OpenAI via .env (${settings?.model ?? "gpt-4o-mini"})`);
  }
});
