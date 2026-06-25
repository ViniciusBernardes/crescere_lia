export interface ProfileResponse {
  type: string
  value?: string
  text?: string
  time?: number
}

export interface UserProfile {
  emotionToday: string | null
  stressLevel: number
  selfcareLevel: number
  emotionsFound: string[]
  caregiverRole: string | null
  journeysCompleted: number[]
  responses: ProfileResponse[]
  challengeArea: string | null
  copingStyle: string | null
  supportNetwork: string | null
  sleepQuality: string | null
}

export function createEmptyProfile(): UserProfile {
  return {
    emotionToday: null,
    stressLevel: 0,
    selfcareLevel: 0,
    emotionsFound: [],
    caregiverRole: null,
    journeysCompleted: [],
    responses: [],
    challengeArea: null,
    copingStyle: null,
    supportNetwork: null,
    sleepQuality: null,
  }
}
