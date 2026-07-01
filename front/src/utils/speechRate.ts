export const SPEECH_RATE_OPTIONS = [0.75, 0.88, 1, 1.5, 2] as const

export type SpeechRate = (typeof SPEECH_RATE_OPTIONS)[number]

export const DEFAULT_SPEECH_RATE: SpeechRate = 0.75

const STORAGE_KEY = 'lia-speech-rate-v2'
const LEGACY_STORAGE_KEY = 'lia-speech-rate'

export function loadSpeechRate(): SpeechRate {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const value = Number(raw)
      return SPEECH_RATE_OPTIONS.includes(value as SpeechRate) ? (value as SpeechRate) : DEFAULT_SPEECH_RATE
    }

    // Migra chave antiga só se o usuário já escolheu velocidade manualmente.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      const value = Number(legacy)
      if (SPEECH_RATE_OPTIONS.includes(value as SpeechRate) && value !== 1) {
        localStorage.setItem(STORAGE_KEY, legacy)
        return value as SpeechRate
      }
    }

    return DEFAULT_SPEECH_RATE
  } catch {
    return DEFAULT_SPEECH_RATE
  }
}

export function saveSpeechRate(rate: SpeechRate): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(rate))
  } catch {
    /* ignore */
  }
}

export function nextSpeechRate(current: SpeechRate): SpeechRate {
  const index = SPEECH_RATE_OPTIONS.indexOf(current)
  return SPEECH_RATE_OPTIONS[(index + 1) % SPEECH_RATE_OPTIONS.length]
}

export function formatSpeechRate(rate: number): string {
  if (Math.abs(rate - 1) < 0.005) return '1×'
  if (rate === 1.5) return '1.5×'
  if (rate === 2) return '2×'
  const label = rate.toFixed(2).replace(/0$/, '')
  return `${label}×`
}

export function speechRateLabel(rate: SpeechRate): string {
  if (rate <= 0.75) return 'Voz lenta'
  if (rate < 1) return 'Voz calma'
  if (rate <= 1) return 'Voz normal'
  if (rate <= 1.5) return 'Voz rápida'
  return 'Voz acelerada'
}
