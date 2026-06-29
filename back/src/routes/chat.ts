import { Router } from "express";
import multer from "multer";
import { isOpenAiConfigured } from "../config.js";
import { createChatReply, transcribeAudio } from "../services/openai.js";
import { resolveTenantSlug } from "../services/tenants.js";
import type { ChatHistoryMessage, ChatRequestBody, JourneyContext } from "../types/chat.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const chatRouter = Router();

function tenantSlugFromRequest(req: import("express").Request) {
  return resolveTenantSlug(req.headers["x-tenant-slug"]);
}

function openAiUnavailable(res: import("express").Response) {
  return res.status(503).json({
    error: "openai_not_configured",
    message:
      "OpenAI não configurada para esta empresa. Cadastre no painel admin (/admin).",
  });
}

function tenantError(res: import("express").Response, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Empresa não encontrada.";
  return res.status(404).json({ error: "tenant_not_found", message });
}

function isValidHistory(history: unknown): history is ChatHistoryMessage[] {
  if (!Array.isArray(history)) return false;
  return history.every(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string",
  );
}

function isValidJourney(journey: unknown): journey is JourneyContext {
  if (!journey || typeof journey !== "object") return false;
  const j = journey as JourneyContext;
  return (
    typeof j.number === "number" &&
    typeof j.title === "string" &&
    typeof j.stepIndex === "number" &&
    typeof j.instruction === "string" &&
    (j.userChoice === undefined || typeof j.userChoice === "string")
  );
}

chatRouter.post("/chat", async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);

  try {
    if (!isOpenAiConfigured(tenantSlug)) {
      return openAiUnavailable(res);
    }
  } catch (error) {
    return tenantError(res, error);
  }

  const body = req.body as ChatRequestBody;
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return res.status(400).json({
      error: "invalid_message",
      message: "O campo message é obrigatório.",
    });
  }

  if (message.length > 4000) {
    return res.status(400).json({
      error: "message_too_long",
      message: "Mensagem muito longa (máx. 4000 caracteres).",
    });
  }

  const history = isValidHistory(body.history) ? body.history : [];
  const journey = isValidJourney(body.journey) ? body.journey : undefined;

  try {
    const result = await createChatReply(
      tenantSlug,
      message,
      body.profile,
      history,
      journey,
    );
    return res.json(result);
  } catch (error) {
    console.error("[chat]", error);
    return res.status(502).json({
      error: "openai_error",
      message: "Não foi possível obter resposta da Lia. Tente novamente.",
    });
  }
});

chatRouter.post("/transcribe", upload.single("audio"), async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);

  try {
    if (!isOpenAiConfigured(tenantSlug)) {
      return openAiUnavailable(res);
    }
  } catch (error) {
    return tenantError(res, error);
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({
      error: "missing_audio",
      message: "Envie um arquivo de áudio no campo audio.",
    });
  }

  try {
    const text = await transcribeAudio(
      tenantSlug,
      file.buffer,
      file.mimetype || "audio/webm",
      file.originalname || "audio.webm",
    );
    return res.json({ text });
  } catch (error) {
    console.error("[transcribe]", error);
    return res.status(502).json({
      error: "transcription_error",
      message: "Não foi possível transcrever o áudio. Tente novamente.",
    });
  }
});
