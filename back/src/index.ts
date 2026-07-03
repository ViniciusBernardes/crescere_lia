import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  config,
  getOpenAiCredentialsSource,
  isOpenAiConfigured,
  resolveOpenAiSettings,
} from "./config.js";
import { initDb } from "./db/database.js";
import { adminRouter } from "./routes/admin.js";
import { chatRouter } from "./routes/chat.js";
import { resolveTenant } from "./services/tenants.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const tenant = await resolveTenant(config.defaultTenantSlug);
    const settings = await resolveOpenAiSettings(tenant.slug);
    res.json({
      status: "ok",
      message: "Crescere LIA API",
      tenant: tenant.slug,
      openai: (await isOpenAiConfigured(tenant.slug)) ? "configured" : "missing_key",
      model: settings?.model ?? null,
      credentialsSource: (await getOpenAiCredentialsSource(tenant.slug)) ?? "none",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao consultar o banco.";
    res.status(503).json({ status: "error", message });
  }
});

app.use("/api/admin", adminRouter);
app.use("/api", chatRouter);

async function main() {
  await initDb();

  app.listen(config.port, "0.0.0.0", async () => {
    console.log(`Server running on http://0.0.0.0:${config.port}`);
    try {
      const tenant = await resolveTenant(config.defaultTenantSlug);
      if (!(await isOpenAiConfigured(tenant.slug))) {
        console.warn(
          `OpenAI não configurada — defina OPENAI_API_KEY no .env ou cadastre em /admin`,
        );
        return;
      }
      const settings = await resolveOpenAiSettings(tenant.slug);
      if ((await getOpenAiCredentialsSource(tenant.slug)) === "env") {
        console.log(`OpenAI via .env (${settings?.model ?? "gpt-4o-mini"})`);
      }
    } catch (error) {
      console.warn("[startup] Aviso:", error);
    }
  });
}

main().catch((error) => {
  console.error("[startup] Falha ao iniciar:", error);
  process.exit(1);
});
