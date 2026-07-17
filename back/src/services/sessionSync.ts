import type { UserProfileContext } from "../types/chat.js";
import { isIclinicaIntegrationEnabled, syncIclinicaSession } from "./iclinica.js";
import { resolveJourneysForTenant } from "./journeys.js";

function stableSessionToken(tenantSlug: string): string {
  return `lia-${tenantSlug}-local`;
}

function needsPsychEscalation(profile?: UserProfileContext): boolean {
  if (!profile) return false;
  return (profile.stressLevel ?? 0) >= 8;
}

export async function syncCaregiverSession(
  tenantSlug: string,
  profile?: UserProfileContext,
  options?: {
    sessionToken?: string;
    displayName?: string;
    currentJourney?: number | null;
  },
): Promise<void> {
  if (!isIclinicaIntegrationEnabled() || !profile) return;

  const { journeys } = await resolveJourneysForTenant(tenantSlug);
  const currentNumber = options?.currentJourney ?? null;
  const currentJourney = currentNumber
    ? journeys.find((j) => j.n === currentNumber)
    : null;

  try {
    const payload: Record<string, unknown> = {
      session_token: options?.sessionToken ?? stableSessionToken(tenantSlug),
      display_name: options?.displayName ?? null,
      profile_json: profile,
      stress_level: profile.stressLevel ?? 0,
      selfcare_level: profile.selfcareLevel ?? 0,
      emotion_today: profile.emotionToday ?? null,
      journeys_completed_count: profile.journeysCompleted?.length ?? 0,
      current_journey: currentNumber,
      current_journey_title: currentJourney?.title ?? null,
      last_activity_at: new Date().toISOString(),
    };

    // Only escalate to plantão on high stress — never clear an explicit request.
    if (needsPsychEscalation(profile)) {
      payload.needs_psych = true;
    }

    await syncIclinicaSession(tenantSlug, payload);
  } catch (error) {
    console.warn("[sessionSync] Falha ao sincronizar com iClinica:", error);
  }
}
