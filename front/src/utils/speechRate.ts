export const SPEECH_RATE_OPTIONS = [0.75, 0.88, 1] as const

export type SpeechRate = (typeof SPEECH_RATE_OPTIONS)[number]

export const DEFAULT_SPEECH_RATE: SpeechRate = 0.88

const STORAGE_KEY = 'lia-speech-rate'

export function loadSpeechRate(): SpeechRate {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SPEECH_RATE
    const value = Number(raw)
    return SPEECH_RATE_OPTIONS.includes(value as SpeechRate) ? (value as SpeechRate) : DEFAULT_SPEECH_RATE
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
  if (rate >= 0.995) return '1×'
  const label = rate.toFixed(2).replace(/0$/, '')
  return `${label}×`
}

export function speechRateLabel(rate: SpeechRate): string {
  if (rate <= 0.75) return 'Voz lenta'
  if (rate < 1) return 'Voz calma'
  return 'Voz normal'
}
