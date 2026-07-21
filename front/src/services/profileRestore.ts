import { createEmptyProfile, type ProfileResponse, type UserProfile } from '../types/profile'

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asJourneyNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => asNumber(v)).filter((v) => v >= 1 && v <= 12)
}

function asResponses(value: unknown): ProfileResponse[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object') as ProfileResponse[]
}

export function parseStoredProfile(raw: Record<string, unknown>): UserProfile {
  const base = createEmptyProfile()

  return {
    ...base,
    emotionToday:
      typeof raw.emotionToday === 'string'
        ? raw.emotionToday
        : raw.emotionToday === null
          ? null
          : base.emotionToday,
    stressLevel: asNumber(raw.stressLevel, base.stressLevel),
    selfcareLevel: asNumber(raw.selfcareLevel, base.selfcareLevel),
    emotionsFound: asStringArray(raw.emotionsFound),
    caregiverRole: typeof raw.caregiverRole === 'string' ? raw.caregiverRole : base.caregiverRole,
    journeysCompleted: asJourneyNumbers(raw.journeysCompleted),
    responses: asResponses(raw.responses),
    challengeArea: typeof raw.challengeArea === 'string' ? raw.challengeArea : base.challengeArea,
    copingStyle: typeof raw.copingStyle === 'string' ? raw.copingStyle : base.copingStyle,
    supportNetwork: typeof raw.supportNetwork === 'string' ? raw.supportNetwork : base.supportNetwork,
    sleepQuality: typeof raw.sleepQuality === 'string' ? raw.sleepQuality : base.sleepQuality,
  }
}

export function progressFromProfile(profile: UserProfile): number {
  if (profile.journeysCompleted.length > 0) {
    return Math.min(100, profile.journeysCompleted.length * 8 + 10)
  }
  if (profile.emotionToday) return 15
  if (profile.stressLevel > 0 || profile.selfcareLevel > 0) return 5
  return 0
}
