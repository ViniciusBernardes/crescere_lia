export interface ProfileStats {
  sessionCount: number;
  streakDays: number;
  journeysCompleted: number;
  journeysTotal: number;
}

interface ProfileResponseRow {
  time?: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseVisitDays(profile: Record<string, unknown>): string[] {
  const raw = profile.visitDays;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string" && ISO_DAY.test(value));
}

export function mergeVisitDays(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): string[] {
  return [...new Set([...parseVisitDays(existing), ...parseVisitDays(incoming)])].sort();
}

export function collectActivityDays(
  profile: Record<string, unknown>,
  visitDays: string[],
  lastActivityAt?: string | Date | null,
): Set<string> {
  const days = new Set(visitDays);

  const responses = profile.responses;
  if (Array.isArray(responses)) {
    for (const row of responses) {
      if (!row || typeof row !== "object") continue;
      const time = Number((row as ProfileResponseRow).time);
      if (!Number.isFinite(time) || time <= 0) continue;
      days.add(isoDate(new Date(time)));
    }
  }

  if (typeof profile.emotionToday === "string" && profile.emotionToday.trim()) {
    days.add(isoDate(new Date()));
  }

  if (lastActivityAt) {
    const parsed = lastActivityAt instanceof Date ? lastActivityAt : new Date(lastActivityAt);
    if (!Number.isNaN(parsed.getTime())) {
      days.add(isoDate(parsed));
    }
  }

  return days;
}

export function sessionCount(
  profile: Record<string, unknown>,
  visitDays: string[],
  lastActivityAt?: string | Date | null,
): number {
  return collectActivityDays(profile, visitDays, lastActivityAt).size;
}

export function streakDays(
  profile: Record<string, unknown>,
  visitDays: string[],
  lastActivityAt?: string | Date | null,
  today: Date = new Date(),
): number {
  const days = collectActivityDays(profile, visitDays, lastActivityAt);
  if (days.size === 0) return 0;

  const cursor = new Date(today);
  let streak = 0;
  while (days.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function journeysCompletedCount(profile: Record<string, unknown>): number {
  const completed = profile.journeysCompleted;
  if (!Array.isArray(completed)) return 0;
  return completed
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1)
    .length;
}

function profileTypeLabel(role: unknown): string | null {
  if (typeof role !== "string") return null;
  const key = role.trim().toLowerCase();
  if (key === "profissional") return "Profissional";
  if (key === "cuidador") return "Cuidador(a)";
  const trimmed = role.trim();
  return trimmed || null;
}

export function deriveProfileTags(profile: Record<string, unknown>): string[] {
  const tags = ["TEA"];
  const role = profile.caregiverRole ?? profile.profile_type ?? profile.profileType;
  const label = profileTypeLabel(role);
  if (label && !tags.includes(label)) {
    tags.push(label);
  }
  return tags;
}

export function buildProfileStats(
  profile: Record<string, unknown>,
  options?: { lastActivityAt?: string | Date | null; journeysTotal?: number },
): ProfileStats {
  const visitDays = parseVisitDays(profile);
  const lastActivityAt = options?.lastActivityAt ?? null;
  return {
    sessionCount: sessionCount(profile, visitDays, lastActivityAt),
    streakDays: streakDays(profile, visitDays, lastActivityAt),
    journeysCompleted: journeysCompletedCount(profile),
    journeysTotal: options?.journeysTotal ?? 12,
  };
}
