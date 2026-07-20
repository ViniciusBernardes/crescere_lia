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
  /** When omitted, existing needs_psych is preserved. */
  needsPsych?: boolean;
  /** When omitted, existing patient_id is preserved. */
  patientId?: number | null;
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
    needsPsych: typeof payload.needsPsych === "boolean" ? payload.needsPsych : undefined,
    patientId: typeof payload.patientId === "number" ? payload.patientId : payload.patientId === null ? null : undefined,
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
    `SELECT id, needs_psych, patient_id FROM lia_caregiver_sessions
     WHERE company_id = ? AND session_token = ?
     LIMIT 1`,
    [companyId, sessionToken],
  );

  if (existing[0]) {
    const needsPsych =
      typeof fields.needsPsych === "boolean"
        ? fields.needsPsych
          ? 1
          : 0
        : existing[0].needs_psych
          ? 1
          : 0;

    const patientId =
      typeof fields.patientId === "number"
        ? fields.patientId
        : fields.patientId === null
          ? null
          : existing[0].patient_id ?? null;

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
        patient_id = ?,
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
        needsPsych,
        patientId,
        existing[0].id,
      ],
    );

    if (patientId) {
      await backfillPatientOnAttendances(Number(existing[0].id), Number(patientId));
    }
    return;
  }

  const [insertResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lia_caregiver_sessions (
      company_id, session_token, display_name, profile_json,
      stress_level, selfcare_level, emotion_today,
      journeys_completed_count, current_journey, current_journey_title,
      needs_psych, patient_id, last_activity_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
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
      typeof fields.patientId === "number" ? fields.patientId : null,
    ],
  );

  const insertedPatientId =
    typeof fields.patientId === "number" ? fields.patientId : null;
  if (insertedPatientId && insertResult.insertId) {
    await backfillPatientOnAttendances(Number(insertResult.insertId), insertedPatientId);
  }
}

async function backfillPatientOnAttendances(
  liaSessionId: number,
  patientId: number,
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE psychologist_attendances
     SET patient_id = ?
     WHERE lia_caregiver_session_id = ? AND patient_id IS NULL`,
    [patientId, liaSessionId],
  );
  await pool.execute(
    `UPDATE clinical_evolutions ce
     INNER JOIN psychologist_attendances pa ON pa.id = ce.psychologist_attendance_id
     SET ce.patient_id = ?
     WHERE pa.lia_caregiver_session_id = ? AND ce.patient_id IS NULL`,
    [patientId, liaSessionId],
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
    const body: Parameters<typeof pushSessionToIclinica>[0] = {
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
      last_activity_at: new Date().toISOString(),
    };
    if (typeof fields.needsPsych === "boolean") {
      body.needs_psych = fields.needsPsych;
    }
    if (typeof fields.patientId === "number" || fields.patientId === null) {
      body.patient_id = fields.patientId;
    }
    await pushSessionToIclinica(body);
    return;
  }

  await syncCaregiverSessionViaDb(Number(tenant.id), token, fields);
}
