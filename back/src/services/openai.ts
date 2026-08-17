import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { resolveOpenAiSettings } from "../config.js";
import { buildChatMessages, toAudioText } from "../prompts/lia.js";
import { extractJourneyRecommendation } from "./journeyRecommendation.js";
import { resolveSystemPrompt } from "./promptConfig.js";
import { resolveTenant } from "./tenants.js";
import { syncCaregiverSession } from "./sessionSync.js";
import type {
  ChatHistoryMessage,
  ChatResponseBody,
  JourneyCatalogItem,
  JourneyContext,
  UserProfileContext,
} from "../types/chat.js";

const clients = new Map<string, OpenAI>();

async function getClient(tenantSlug: string): Promise<OpenAI> {
  const settings = await resolveOpenAiSettings(tenantSlug);
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
  journeys?: JourneyCatalogItem[],
): Promise<ChatResponseBody> {
  const openai = await getClient(tenantSlug);
  const settings = (await resolveOpenAiSettings(tenantSlug))!;
  const tenant = await resolveTenant(tenantSlug);
  const systemPrompt = await resolveSystemPrompt(tenant.id, tenant.slug, profile);
  const messages = buildChatMessages(
    message,
    profile,
    history,
    journey,
    systemPrompt,
    journeys,
  );

  const completion = await openai.chat.completions.create({
    model: settings.model,
    messages,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
  });

  const rawReply = completion.choices[0]?.message?.content?.trim();
  if (!rawReply) {
    throw new Error("Resposta vazia da OpenAI");
  }

  void syncCaregiverSession(tenant.slug, profile, {
    currentJourney: journey?.number ?? null,
  }).catch(() => undefined);

  const inGuidedJourney = journey != null && journey.number > 0;
  const { reply, recommendation } = inGuidedJourney
    ? { reply: rawReply, recommendation: null }
    : extractJourneyRecommendation(rawReply);

  return {
    reply,
    audioText: toAudioText(reply),
    ...(recommendation ? { journeyRecommendation: recommendation } : {}),
  };
}

export async function synthesizeSpeech(
  tenantSlug: string,
  text: string,
): Promise<Buffer> {
  const openai = await getClient(tenantSlug);
  const settings = (await resolveOpenAiSettings(tenantSlug))!;

  const speech = await openai.audio.speech.create({
    model: settings.ttsModel,
    voice: settings.ttsVoice,
    input: text,
  });

  return Buffer.from(await speech.arrayBuffer());
}

export async function transcribeAudio(
  tenantSlug: string,
  buffer: Buffer,
  mimeType: string,
  filename = "audio.webm",
): Promise<string> {
  const openai = await getClient(tenantSlug);
  const settings = (await resolveOpenAiSettings(tenantSlug))!;
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
