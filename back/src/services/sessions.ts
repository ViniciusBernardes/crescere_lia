import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../db/database.js";
import {
  isIclinicaSyncConfigured,
  pushSessionToIclinica,
} from "./iclinicaSync.js";
import { resolveTenant } from "./tenants.js";

export interface SyncSessionPayload {
  sessionToken: string;
  displayName?: string;
  profile: Record<string, unknown>;
  needsPsych?: boolean;
}

const JOURNEY_TITLES: Record<number, string> = {
  1: "Acolhimento e Chegada",
  2: "Compreendendo o TEA",
  3: "Sentimentos diante do diagnóstico",
  4: "Autoavaliação e Autopercepção",
  5: "Cuidar de Si para Continuar",
  6: "Estratégias de Manejo com a Criança",
  7: "A Rede de Apoio",
  8: "Direitos, Deveres e Orientações",
  9: "Momentos de Crise",
  10: "Como o Cérebro Aprende",
  11: "Potencialidades, Identidade e Futuro",
  12: "Escola, Sociedade e Inclusão",
};

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function journeyMeta(profile: Record<string, unknown>) {
  const completed = Array.isArray(profile.journeysCompleted)
    ? profile.journeysCompleted.map((v) => asNumber(v)).filter((v) => v >= 1 && v <= 12)
    : [];
  const current = completed.length > 0 ? Math.min(12, Math.max(...completed) + 1) : null;

  return {
    journeys_completed_count: completed.length,
    current_journey: current,
    current_journey_title: current ? JOURNEY_TITLES[current] ?? null : null,
  };
}

function buildSessionFields(payload: SyncSessionPayload) {
  const profile = payload.profile ?? {};
  const meta = journeyMeta(profile);

  return {
    profile,
    stress: asNumber(profile.stressLevel),
    selfcare: asNumber(profile.selfcareLevel),
    emotionToday:
      typeof profile.emotionToday === "string" ? profile.emotionToday.slice(0, 120) : null,
    displayName: payload.displayName?.trim().slice(0, 120) || null,
    needsPsych: Boolean(payload.needsPsych),
    meta,
  };
}

async function syncCaregiverSessionViaDb(
  companyId: number,
  sessionToken: string,
  fields: ReturnType<typeof buildSessionFields>,
): Promise<void> {
  const profileJson = JSON.stringify(fields.profile);
  const pool = getPool();

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM lia_caregiver_sessions
     WHERE company_id = ? AND session_token = ?
     LIMIT 1`,
    [companyId, sessionToken],
  );

  if (existing[0]) {
    await pool.execute(
      `UPDATE lia_caregiver_sessions SET
        display_name = COALESCE(?, display_name),
        profile_json = ?,
        stress_level = ?,
        selfcare_level = ?,
        emotion_today = ?,
        journeys_completed_count = ?,
        current_journey = ?,
        current_journey_title = ?,
        needs_psych = ?,
        last_activity_at = NOW(),
        updated_at = NOW()
       WHERE id = ?`,
      [
        fields.displayName,
        profileJson,
        fields.stress,
        fields.selfcare,
        fields.emotionToday,
        fields.meta.journeys_completed_count,
        fields.meta.current_journey,
        fields.meta.current_journey_title,
        fields.needsPsych ? 1 : 0,
        existing[0].id,
      ],
    );
    return;
  }

  await pool.execute<ResultSetHeader>(
    `INSERT INTO lia_caregiver_sessions (
      company_id, session_token, display_name, profile_json,
      stress_level, selfcare_level, emotion_today,
      journeys_completed_count, current_journey, current_journey_title,
      needs_psych, last_activity_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      companyId,
      sessionToken,
      fields.displayName,
      profileJson,
      fields.stress,
      fields.selfcare,
      fields.emotionToday,
      fields.meta.journeys_completed_count,
      fields.meta.current_journey,
      fields.meta.current_journey_title,
      fields.needsPsych ? 1 : 0,
    ],
  );
}

export async function syncCaregiverSession(
  tenantSlug: string,
  payload: SyncSessionPayload,
): Promise<void> {
  const token = payload.sessionToken.trim();
  if (!token) throw new Error("sessionToken é obrigatório");

  const tenant = await resolveTenant(tenantSlug);
  const fields = buildSessionFields(payload);

  if (isIclinicaSyncConfigured()) {
    await pushSessionToIclinica({
      company_slug: tenant.slug,
      session_token: token,
      display_name: fields.displayName,
      profile_json: fields.profile,
      stress_level: fields.stress,
      selfcare_level: fields.selfcare,
      emotion_today: fields.emotionToday,
      journeys_completed_count: fields.meta.journeys_completed_count,
      current_journey: fields.meta.current_journey,
      current_journey_title: fields.meta.current_journey_title,
      needs_psych: fields.needsPsych,
      last_activity_at: new Date().toISOString(),
    });
    return;
  }

  await syncCaregiverSessionViaDb(Number(tenant.id), token, fields);
}
