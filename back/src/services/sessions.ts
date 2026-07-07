import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../db/database.js";
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

export async function syncCaregiverSession(
  tenantSlug: string,
  payload: SyncSessionPayload,
): Promise<void> {
  const token = payload.sessionToken.trim();
  if (!token) throw new Error("sessionToken é obrigatório");

  const tenant = await resolveTenant(tenantSlug);
  const companyId = Number(tenant.id);
  const profile = payload.profile ?? {};
  const meta = journeyMeta(profile);

  const stress = asNumber(profile.stressLevel);
  const selfcare = asNumber(profile.selfcareLevel);
  const emotionToday =
    typeof profile.emotionToday === "string" ? profile.emotionToday.slice(0, 120) : null;
  const displayName = payload.displayName?.trim().slice(0, 120) || null;
  const needsPsych = Boolean(payload.needsPsych);
  const profileJson = JSON.stringify(profile);

  const pool = getPool();

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM lia_caregiver_sessions
     WHERE company_id = ? AND session_token = ?
     LIMIT 1`,
    [companyId, token],
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
        displayName,
        profileJson,
        stress,
        selfcare,
        emotionToday,
        meta.journeys_completed_count,
        meta.current_journey,
        meta.current_journey_title,
        needsPsych ? 1 : 0,
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
      token,
      displayName,
      profileJson,
      stress,
      selfcare,
      emotionToday,
      meta.journeys_completed_count,
      meta.current_journey,
      meta.current_journey_title,
      needsPsych ? 1 : 0,
    ],
  );
}
