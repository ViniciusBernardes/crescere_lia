import { Router } from "express";
import OpenAI from "openai";
import multer from "multer";
import type { RowDataPacket } from "mysql2/promise";
import { isOpenAiConfigured } from "../config.js";
import { createChatReply, synthesizeSpeech, transcribeAudio } from "../services/openai.js";
import { DEFAULT_IDLE_TIMEOUT_MS, getIdleTimeoutMs } from "../services/appConfig.js";
import { getTenantBySlug, resolveTenantSlug } from "../services/tenants.js";
import { getPool } from "../db/database.js";
import {
  fetchPsychChatMessages,
  fetchPsychStatusFromIclinica,
  fetchVideoTokenFromIclinica,
  sendPsychChatMessage,
  isIclinicaSyncConfigured,
} from "../services/iclinicaSync.js";
import type { ChatHistoryMessage, ChatRequestBody, JourneyContext } from "../types/chat.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const chatRouter = Router();

function tenantSlugFromRequest(req: import("express").Request) {
  return resolveTenantSlug(req.headers["x-tenant-slug"]);
}

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

function openAiErrorResponse(res: import("express").Response, error: unknown) {
  console.error("[chat]", error);

  if (error instanceof OpenAI.APIError) {
    if (error.status === 429 && error.code === "insufficient_quota") {
      return res.status(402).json({
        error: "openai_quota",
        message:
          "Créditos da OpenAI esgotados nesta conta. Confira billing em platform.openai.com e use uma chave com saldo.",
      });
    }
    if (error.status === 401) {
      return res.status(401).json({
        error: "openai_auth",
        message: "Chave OpenAI inválida. Verifique OPENAI_API_KEY no back/.env",
      });
    }
  }

  return res.status(502).json({
    error: "openai_error",
    message: "Não foi possível obter resposta da Lia. Tente novamente.",
  });
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

function wantsSpeech(req: import("express").Request): boolean {
  return req.header("x-tts-enabled") === "true";
}

chatRouter.get("/settings", async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return tenantError(res, new Error(`Empresa não encontrada: ${tenantSlug}`));
    }
    const idleTimeoutMs = await getIdleTimeoutMs(tenant.id);
    return res.json({
      tenantSlug: tenant.slug,
      idleTimeoutMs,
    });
  } catch (error) {
    console.warn("[settings] Falha ao ler config, usando padrão:", error);
    return res.json({
      tenantSlug,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    });
  }
});

chatRouter.post("/chat", async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);

  try {
    if (!(await isOpenAiConfigured(tenantSlug))) {
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

    if (wantsSpeech(req) && result.audioText) {
      try {
        const audio = await synthesizeSpeech(tenantSlug, result.audioText);
        result.speechAudio = audio.toString("base64");
      } catch (error) {
        console.warn("[chat] Falha ao gerar voz inline:", error);
      }
    }

    return res.json(result);
  } catch (error) {
    return openAiErrorResponse(res, error);
  }
});

chatRouter.post("/tts", async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);

  try {
    if (!(await isOpenAiConfigured(tenantSlug))) {
      return openAiUnavailable(res);
    }
  } catch (error) {
    return tenantError(res, error);
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({
      error: "invalid_text",
      message: "O campo text é obrigatório.",
    });
  }

  if (text.length > 4096) {
    return res.status(400).json({
      error: "text_too_long",
      message: "Texto muito longo para síntese de voz (máx. 4096 caracteres).",
    });
  }

  try {
    const audio = await synthesizeSpeech(tenantSlug, text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(audio);
  } catch (error) {
    console.error("[tts]", error);
    return openAiErrorResponse(res, error);
  }
});

chatRouter.get("/chat/psych/status", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.json({ attendance_id: null, status: "unavailable" });
  }
  const tenantSlug = tenantSlugFromRequest(req);
  const sessionToken = sessionTokenFromRequest(req);
  if (!sessionToken) {
    return res.status(400).json({ error: "missing_session_token" });
  }
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return res.json({ attendance_id: null, status: "no_tenant" });

    const data = await fetchPsychStatusFromIclinica(tenant.slug, sessionToken);
    return res.json(data);
  } catch (error) {
    console.error("[psych-chat] status error:", error);
    return res.json({ attendance_id: null, status: "error" });
  }
});

chatRouter.get("/chat/psych/messages", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.status(503).json({ error: "integration_not_configured" });
  }
  const tenantSlug = tenantSlugFromRequest(req);
  const sessionToken = sessionTokenFromRequest(req);
  const attendanceId = Number(req.query.attendance_id);
  const afterId = Number(req.query.after) || 0;
  if (!sessionToken) {
    return res.status(400).json({ error: "missing_session_token" });
  }
  if (!attendanceId) {
    return res.status(400).json({ error: "missing_attendance_id" });
  }
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });
    const data = await fetchPsychChatMessages(tenant.slug, sessionToken, attendanceId, afterId);
    return res.json(data);
  } catch (error) {
    console.error("[psych-chat] fetch messages error:", error);
    return res.status(502).json({ error: "upstream_error" });
  }
});

chatRouter.get("/chat/psych/video-token", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.status(503).json({ error: "integration_not_configured" });
  }
  const tenantSlug = tenantSlugFromRequest(req);
  const sessionToken = sessionTokenFromRequest(req);
  const attendanceId = Number(req.query.attendance_id);
  if (!sessionToken) {
    return res.status(400).json({ error: "missing_session_token" });
  }
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });

    if (attendanceId) {
      const tokenData = await fetchVideoTokenFromIclinica(tenant.slug, sessionToken, attendanceId);
      return res.json(tokenData);
    }

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pa.id
       FROM psychologist_attendances pa
       JOIN lia_caregiver_sessions lcs ON lcs.id = pa.lia_caregiver_session_id
       WHERE lcs.company_id = ?
         AND lcs.session_token = ?
         AND pa.status = 'in_progress'
         AND pa.channel = 'video'
         AND pa.livekit_room_name IS NOT NULL
       ORDER BY pa.created_at DESC
       LIMIT 1`,
      [tenant.id, sessionToken],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "no_active_video" });
    }

    const tokenData = await fetchVideoTokenFromIclinica(
      tenant.slug,
      sessionToken,
      Number(rows[0].id),
    );
    return res.json(tokenData);
  } catch (error) {
    console.error("[psych-video] token error:", error);
    return res.status(502).json({ error: "upstream_error" });
  }
});

chatRouter.post("/chat/psych/send", async (req, res) => {
  if (!isIclinicaSyncConfigured()) {
    return res.status(503).json({ error: "integration_not_configured" });
  }
  const tenantSlug = tenantSlugFromRequest(req);
  const sessionToken = sessionTokenFromRequest(req);
  const attendanceId = Number(req.body?.attendance_id);
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!sessionToken) {
    return res.status(400).json({ error: "missing_session_token" });
  }
  if (!attendanceId || !body) {
    return res.status(400).json({ error: "missing_fields" });
  }
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return res.status(404).json({ error: "tenant_not_found" });
    const msg = await sendPsychChatMessage(tenant.slug, sessionToken, attendanceId, body);
    return res.json(msg);
  } catch (error) {
    console.error("[psych-chat] send error:", error);
    return res.status(502).json({ error: "upstream_error" });
  }
});

chatRouter.post("/transcribe", upload.single("audio"), async (req, res) => {
  const tenantSlug = tenantSlugFromRequest(req);

  try {
    if (!(await isOpenAiConfigured(tenantSlug))) {
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
    return openAiErrorResponse(res, error);
  }
});
