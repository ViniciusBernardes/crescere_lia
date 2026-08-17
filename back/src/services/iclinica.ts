import type { UserProfileContext } from "../types/chat.js";

const CACHE_TTL_MS = 10 * 60 * 1000;

export interface IclinicaJourneyQuestion {
  id: number;
  sort_order: number;
  type: "open" | "multiple_choice";
  prompt: string;
  options: string[];
}

export interface IclinicaJourney {
  number: number;
  title: string;
  subtitle: string | null;
  icon: string;
  color: string;
  is_global: boolean;
  meda_dimension: string | null;
  competencies: string[];
  activation_signals: string[];
  questions: IclinicaJourneyQuestion[];
  steps?: Array<Record<string, unknown>>;
}

export interface IclinicaPromptResponse {
  company_slug: string;
  system_prompt: string;
  journeys: IclinicaJourney[];
  version: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const promptCache = new Map<string, CacheEntry<string>>();
const journeysCache = new Map<string, CacheEntry<IclinicaJourney[]>>();

function iclinicaBaseUrl(): string | null {
  const url = process.env.ICLINICA_API_URL?.trim().replace(/\/$/, "");
  return url || null;
}

function syncSecret(): string | null {
  const secret = process.env.LIA_SYNC_SECRET?.trim();
  return secret || null;
}

export function isIclinicaIntegrationEnabled(): boolean {
  return Boolean(iclinicaBaseUrl() && syncSecret());
}

function profileToQuery(profile?: UserProfileContext): URLSearchParams {
  const params = new URLSearchParams();
  if (!profile) return params;

  if (profile.caregiverRole) params.set("role", profile.caregiverRole);
  if (profile.emotionToday) params.set("emotion_today", profile.emotionToday);
  if (profile.stressLevel !== undefined) {
    params.set("stress_level", String(profile.stressLevel));
  }
  if (profile.selfcareLevel !== undefined) {
    params.set("selfcare_level", String(profile.selfcareLevel));
  }
  if (profile.journeysCompleted?.length) {
    params.set("journeys_completed", profile.journeysCompleted.join(","));
    params.set(
      "journeys_completed_count",
      String(profile.journeysCompleted.length),
    );
  }

  return params;
}

async function iclinicaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = iclinicaBaseUrl();
  const secret = syncSecret();
  if (!base || !secret) {
    throw new Error("Integração iClinica não configurada");
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "X-Lia-Sync-Secret": secret,
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
  };

  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : `iClinica respondeu ${res.status}`,
    );
  }

  return data;
}

export async function fetchIclinicaJourneys(
  companySlug: string,
): Promise<IclinicaJourney[]> {
  const cached = journeysCache.get(companySlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const data = await iclinicaFetch<{ journeys: IclinicaJourney[] }>(
    `/api/v1/integrations/lia/journeys?company_slug=${encodeURIComponent(companySlug)}`,
  );

  const journeys = data.journeys ?? [];
  journeysCache.set(companySlug, {
    value: journeys,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return journeys;
}

export async function fetchIclinicaSystemPrompt(
  companySlug: string,
  profile?: UserProfileContext,
): Promise<string> {
  const useCache = !profile;
  const cacheKey = companySlug;

  if (useCache) {
    const cached = promptCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const query = profileToQuery(profile);
  query.set("company_slug", companySlug);

  const data = await iclinicaFetch<IclinicaPromptResponse>(
    `/api/v1/integrations/lia/prompt?${query.toString()}`,
  );

  const prompt = data.system_prompt?.trim();
  if (!prompt) {
    throw new Error("iClinica retornou prompt vazio");
  }

  if (useCache) {
    promptCache.set(cacheKey, {
      value: prompt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return prompt;
}

export async function syncIclinicaSession(
  companySlug: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isIclinicaIntegrationEnabled()) return;

  await iclinicaFetch("/api/v1/integrations/lia/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_slug: companySlug,
      ...payload,
    }),
  });
}

export function clearIclinicaCache(companySlug?: string) {
  if (companySlug) {
    promptCache.delete(companySlug);
    journeysCache.delete(companySlug);
    return;
  }
  promptCache.clear();
  journeysCache.clear();
}
