import type { UserProfile } from '../types/profile'

export type ChatRole = 'user' | 'assistant'

export interface ChatHistoryMessage {
  role: ChatRole
  content: string
}

export interface ChatResponse {
  reply: string
  audioText: string
  speechAudio?: string
}

export interface JourneyStepRequest {
  journeyNumber: number
  journeyTitle: string
  stepIndex: number
  instruction: string
  userChoice?: string
  profile?: UserProfile
  history?: ChatHistoryMessage[]
}

export interface HealthResponse {
  status: string
  message: string
  openai: 'configured' | 'missing_key'
  model: string | null
}

export interface LiaApiError {
  error: string
  message: string
}

const API_BASE = '/api'
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'crescere'

function apiHeaders(extra?: HeadersInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    ...extra,
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & LiaApiError
  if (!res.ok) {
    throw new Error(data.message || `Erro na API (${res.status})`)
  }
  return data
}

export function isAiChatEnabled(): boolean {
  return import.meta.env.VITE_USE_AI_CHAT === 'true'
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`)
  return parseJson<HealthResponse>(res)
}

function chatHeaders(includeSpeech?: boolean): HeadersInit {
  return apiHeaders(includeSpeech ? { 'X-TTS-Enabled': 'true' } : undefined)
}

export async function sendChatMessage(
  message: string,
  options?: {
    profile?: UserProfile
    history?: ChatHistoryMessage[]
    includeSpeech?: boolean
  },
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: chatHeaders(options?.includeSpeech),
    body: JSON.stringify({
      message,
      profile: options?.profile,
      history: options?.history,
    }),
  })
  return parseJson<ChatResponse>(res)
}

export async function sendJourneyStep(
  options: JourneyStepRequest & { includeSpeech?: boolean },
): Promise<ChatResponse> {
  const message = options.userChoice
    ? `[Jornada ${options.journeyNumber}] ${options.instruction}`
    : `[Jornada ${options.journeyNumber}] ${options.instruction}`

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: chatHeaders(options.includeSpeech),
    body: JSON.stringify({
      message,
      profile: options.profile,
      history: options.history,
      journey: {
        number: options.journeyNumber,
        title: options.journeyTitle,
        stepIndex: options.stepIndex,
        instruction: options.instruction,
        userChoice: options.userChoice,
      },
    }),
  })
  return parseJson<ChatResponse>(res)
}

export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as LiaApiError
    throw new Error(data.message || `Erro na síntese de voz (${res.status})`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('audio')) {
    throw new Error('Resposta inválida da síntese de voz')
  }

  return res.blob()
}

export async function transcribeAudio(blob: Blob, filename = 'gravacao.webm'): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, filename)

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'X-Tenant-Slug': TENANT_SLUG },
    body: form,
  })
  const data = await parseJson<{ text: string }>(res)
  return data.text
}
