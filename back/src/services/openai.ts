import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { resolveOpenAiSettings } from "../config.js";
import { buildChatMessages, toAudioText } from "../prompts/lia.js";
import type {
  ChatHistoryMessage,
  ChatResponseBody,
  JourneyContext,
  UserProfileContext,
} from "../types/chat.js";

const clients = new Map<string, OpenAI>();

function getClient(tenantSlug: string): OpenAI {
  const settings = resolveOpenAiSettings(tenantSlug);
  if (!settings?.apiKey) {
    throw new Error("Credenciais OpenAI não configuradas para esta empresa");
  }

  const cacheKey = `${tenantSlug}:${settings.apiKey}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey: settings.apiKey });
    clients.set(cacheKey, client);
  }
  return client;
}

export async function createChatReply(
  tenantSlug: string,
  message: string,
  profile?: UserProfileContext,
  history: ChatHistoryMessage[] = [],
  journey?: JourneyContext,
): Promise<ChatResponseBody> {
  const openai = getClient(tenantSlug);
  const settings = resolveOpenAiSettings(tenantSlug)!;
  const messages = buildChatMessages(message, profile, history, journey);

  const completion = await openai.chat.completions.create({
    model: settings.model,
    messages,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Resposta vazia da OpenAI");
  }

  return {
    reply,
    audioText: toAudioText(reply),
  };
}

export async function transcribeAudio(
  tenantSlug: string,
  buffer: Buffer,
  mimeType: string,
  filename = "audio.webm",
): Promise<string> {
  const openai = getClient(tenantSlug);
  const settings = resolveOpenAiSettings(tenantSlug)!;
  const file = await toFile(buffer, filename, { type: mimeType });

  const result = await openai.audio.transcriptions.create({
    file,
    model: settings.whisperModel,
    language: "pt",
  });

  const text = result.text?.trim();
  if (!text) {
    throw new Error("Transcrição vazia");
  }

  return text;
}
