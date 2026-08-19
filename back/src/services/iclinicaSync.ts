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
  fcm_token?: string | null;
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
  steps?: Array<Record<string, unknown>>;
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

/**
 * Lightweight keep-alive — only updates last_activity_at on the backend.
 * Use instead of the full syncSession when the caregiver is just waiting in the queue.
 */
export async function heartbeatSession(
  companySlug: string,
  sessionToken: string,
): Promise<void> {
  await iclinicaRequest("/api/v1/integrations/lia/sessions/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      company_slug: companySlug.trim().toLowerCase(),
      session_token: sessionToken,
    }),
  });
}

export async function pushSessionToIclinica(
  payload: IclinicaSessionPayload,
): Promise<void> {
  await iclinicaRequest("/api/v1/integrations/lia/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface IclinicaSessionSnapshot {
  session_id: number;
  session_token: string;
  display_name: string | null;
  patient_id: number | null;
  needs_psych: boolean;
  stress_level: number;
  selfcare_level: number;
  emotion_today: string | null;
  profile_json: Record<string, unknown>;
  journeys_completed_count: number;
  current_journey: number | null;
  current_journey_title: string | null;
  last_activity_at: string | null;
}

export async function fetchSessionFromIclinica(
  companySlug: string,
  sessionToken: string,
): Promise<IclinicaSessionSnapshot> {
  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
    session_token: sessionToken,
  });
  return iclinicaRequest<IclinicaSessionSnapshot>(
    `/api/v1/integrations/lia/sessions/me?${query}`,
  );
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

export interface PsychStatusResponse {
  attendance_id: number | null;
  status: string;
  channel: string | null;
  has_video_room?: boolean;
  professional_name?: string | null;
  queue_position?: number | null;
  queue_size?: number | null;
  psych_requested_at?: string | null;
}

export interface VideoTokenResponse {
  token: string;
  ws_url: string;
  room_name: string;
}

export async function fetchPsychStatusFromIclinica(
  companySlug: string,
  sessionToken: string,
): Promise<PsychStatusResponse> {
  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
    session_token: sessionToken,
  });
  return iclinicaRequest<PsychStatusResponse>(
    `/api/v1/integrations/lia/chat/status?${query}`,
  );
}

export async function fetchPsychChatMessages(
  companySlug: string,
  sessionToken: string,
  attendanceId: number,
  afterId = 0,
): Promise<PsychChatMessagesResponse> {
  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
    session_token: sessionToken,
    attendance_id: String(attendanceId),
    after: String(afterId),
  });
  return iclinicaRequest<PsychChatMessagesResponse>(
    `/api/v1/integrations/lia/chat/messages?${query}`,
  );
}

/** Open upstream SSE for plantão chat (Node proxies the stream to the browser). */
export async function openPsychChatStream(
  companySlug: string,
  sessionToken: string,
  attendanceId: number,
  afterId = 0,
): Promise<Response> {
  const base = apiBaseUrl();
  const secret = syncSecret();
  if (!base || !secret) {
    throw new Error("Integração iClinica não configurada (ICLINICA_API_URL / LIA_SYNC_SECRET).");
  }

  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
    session_token: sessionToken,
    attendance_id: String(attendanceId),
    after: String(afterId),
  });

  return fetch(`${base}/api/v1/integrations/lia/chat/stream?${query}`, {
    headers: {
      Accept: "text/event-stream",
      "X-Lia-Sync-Secret": secret,
    },
  });
}

export async function sendPsychChatMessage(
  companySlug: string,
  sessionToken: string,
  attendanceId: number,
  body: string,
): Promise<PsychChatMessage> {
  return iclinicaRequest<PsychChatMessage>(
    `/api/v1/integrations/lia/chat/send`,
    {
      method: "POST",
      body: JSON.stringify({
        company_slug: companySlug.trim().toLowerCase(),
        session_token: sessionToken,
        attendance_id: attendanceId,
        body,
      }),
    },
  );
}

export async function fetchVideoTokenFromIclinica(
  companySlug: string,
  sessionToken: string,
  attendanceId: number,
): Promise<VideoTokenResponse> {
  const params: Record<string, string> = {
    company_slug: companySlug.trim().toLowerCase(),
    session_token: sessionToken,
  };
  // Only include attendance_id when provided — Laravel will auto-resolve the active video attendance.
  if (attendanceId) {
    params.attendance_id = String(attendanceId);
  }
  const query = new URLSearchParams(params);
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

export async function registerPatientInIclinica(payload: {
  company_slug: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  profile_type?: string;
}): Promise<{ id: number; name: string; email: string }> {
  const data = await iclinicaRequest<IclinicaPatientAuthResponse>(
    "/api/v1/integrations/lia/auth/register",
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

export async function forgotPatientPasswordInIclinica(payload: {
  company_slug: string;
  email: string;
}): Promise<{ message: string }> {
  return iclinicaRequest<{ message: string }>(
    "/api/v1/integrations/lia/auth/forgot",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function resetPatientPasswordInIclinica(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return iclinicaRequest<{ message: string }>(
    "/api/v1/integrations/lia/auth/reset",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchProfessionalsFromIclinica(
  companySlug: string,
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
  });
  return iclinicaRequest<Record<string, unknown>>(
    `/api/v1/integrations/lia/professionals?${query}`,
  );
}

export async function fetchLibraryFromIclinica(
  companySlug: string,
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({
    company_slug: companySlug.trim().toLowerCase(),
  });
  return iclinicaRequest<Record<string, unknown>>(
    `/api/v1/integrations/lia/library?${query}`,
  );
}

/**
 * Poll plantão status for the caregiver and push SSE events until the
 * attendance reaches a terminal state or the client disconnects.
 *
 * Events emitted:
 *   data: {"status":"waiting"|"in_progress"|"ended"|"unavailable", "attendance_id": number|null, ...}
 *
 * The caller is responsible for calling `onClose` when the request closes.
 */
export async function streamPlantaoStatus(
  companySlug: string,
  sessionToken: string,
  onEvent: (data: PsychStatusResponse) => void,
  signal: AbortSignal,
): Promise<void> {
  const POLL_INTERVAL_MS = 1500;
  const MAX_DURATION_MS = 30 * 60 * 1000; // 30 min safety cap

  const started = Date.now();

  while (!signal.aborted && Date.now() - started < MAX_DURATION_MS) {
    try {
      const status = await fetchPsychStatusFromIclinica(companySlug, sessionToken);
      onEvent(status);

      const terminal =
        status.status === "ended" ||
        status.status === "unavailable" ||
        status.status === "error";
      if (terminal) break;
    } catch {
      // Transient upstream error — keep looping; Flutter will handle reconnect.
    }

    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, POLL_INTERVAL_MS);
      signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}

export async function endVideoCallInIclinica(
  companySlug: string,
  sessionToken: string,
  attendanceId: number,
): Promise<Record<string, unknown>> {
  return iclinicaRequest<Record<string, unknown>>(
    "/api/v1/integrations/lia/video/end",
    {
      method: "POST",
      headers: {
        "X-Lia-Session-Token": sessionToken,
      },
      body: JSON.stringify({
        company_slug: companySlug.trim().toLowerCase(),
        session_token: sessionToken,
        attendance_id: attendanceId,
      }),
    },
  );
}
