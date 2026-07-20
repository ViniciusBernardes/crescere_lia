export interface IclinicaSessionPayload {
  company_slug: string;
  session_token: string;
  display_name?: string | null;
  profile_json?: Record<string, unknown>;
  stress_level?: number;
  selfcare_level?: number;
  emotion_today?: string | null;
  journeys_completed_count?: number;
  current_journey?: number | null;
  current_journey_title?: string | null;
  needs_psych?: boolean;
  last_activity_at?: string;
  patient_id?: number | null;
}

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
  icon: string | null;
  color: string | null;
  is_global: boolean;
  questions: IclinicaJourneyQuestion[];
}

export interface IclinicaJourneysResponse {
  company_slug: string;
  journeys: IclinicaJourney[];
}

function apiBaseUrl(): string {
  return process.env.ICLINICA_API_URL?.trim().replace(/\/+$/, "") ?? "";
}

function syncSecret(): string {
  return process.env.LIA_SYNC_SECRET?.trim() ?? "";
}

export function isIclinicaSyncConfigured(): boolean {
  return apiBaseUrl() !== "" && syncSecret() !== "";
}

async function iclinicaRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = apiBaseUrl();
  const secret = syncSecret();
  if (!base || !secret) {
    throw new Error("Integração iClinica não configurada (ICLINICA_API_URL / LIA_SYNC_SECRET).");
  }

  const headers = new Headers(init.headers);
  headers.set("X-Lia-Sync-Secret", secret);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : text || `HTTP ${res.status}`;
    const error = new Error(`iClinica: ${message}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

export async function pushSessionToIclinica(
  payload: IclinicaSessionPayload,
): Promise<void> {
  await iclinicaRequest("/api/v1/integrations/lia/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchJourneysFromIclinica(
  companySlug: string,
): Promise<IclinicaJourneysResponse> {
  const slug = companySlug.trim().toLowerCase();
  const query = new URLSearchParams({ company_slug: slug });
  return iclinicaRequest<IclinicaJourneysResponse>(
    `/api/v1/integrations/lia/journeys?${query}`,
  );
}

export interface PsychChatMessage {
  id: number;
  sender_type: "psychologist" | "caregiver";
  body: string;
  created_at: string;
}

export interface PsychChatMessagesResponse {
  messages: PsychChatMessage[];
  attendance_status: string;
}

export async function fetchPsychChatMessages(
  attendanceId: number,
  afterId = 0,
): Promise<PsychChatMessagesResponse> {
  const query = new URLSearchParams({
    attendance_id: String(attendanceId),
    after: String(afterId),
  });
  return iclinicaRequest<PsychChatMessagesResponse>(
    `/api/v1/integrations/lia/chat/messages?${query}`,
  );
}

export async function sendPsychChatMessage(
  attendanceId: number,
  body: string,
): Promise<PsychChatMessage> {
  return iclinicaRequest<PsychChatMessage>(
    `/api/v1/integrations/lia/chat/send`,
    { method: "POST", body: JSON.stringify({ attendance_id: attendanceId, body }) },
  );
}

export interface VideoTokenResponse {
  token: string;
  ws_url: string;
  room_name: string;
}

export async function fetchVideoTokenFromIclinica(
  attendanceId: number,
): Promise<VideoTokenResponse> {
  const query = new URLSearchParams({ attendance_id: String(attendanceId) });
  return iclinicaRequest<VideoTokenResponse>(
    `/api/v1/integrations/lia/video/token?${query}`,
  );
}

export type IclinicaPatientAuthResponse = {
  patient: {
    id: number;
    name: string;
    email: string | null;
  };
};

export async function loginPatientInIclinica(payload: {
  company_slug: string;
  email: string;
  password: string;
}): Promise<{ id: number; name: string; email: string }> {
  const data = await iclinicaRequest<IclinicaPatientAuthResponse>(
    "/api/v1/integrations/lia/auth",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return {
    id: data.patient.id,
    name: data.patient.name,
    email: data.patient.email ?? payload.email,
  };
}
